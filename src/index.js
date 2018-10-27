const stringValidator = require('./types/string');
const numberValidator = require('./types/number');
const booleanValidator = require('./types/boolean');
const dateValidator = require('./types/date');
const arrayValidator = require('./types/array');
const objectValidator = require('./types/object');

const validators = new Map([
	[String, stringValidator],
	[Number, numberValidator],
	[Boolean, booleanValidator],
	[Date, dateValidator],
	[Array, arrayValidator],
	[Object, objectValidator]
]);

class Schema {
	constructor(schema) {
		// Verify that the input is an Object.
		if (Object.prototype.toString.call(schema) !== '[object Object]')
			throw Error('Schema must be an object');

		// Validate that the schema is formatted correctly
		// and compile shortcuts into the verbose syntax.
		const compiledSchema = this.compileSchema(schema);

		// Save it for reference.
		this.__schema = compiledSchema;
	}

	static get validators() {
		return validators;
	}

	/*
	 * Compile short schema syntax into verbose one.
	 */
	compileSchemaField(fieldSchema, fieldName) {
		// Check if the prop is using the shortcut syntax, if it is
		// then replace it with a schema that uses the verbose syntax.
		// This check only works for "primitive" types.
		if (validators.has(fieldSchema)) {
			fieldSchema = { type: fieldSchema };
		}

		// Check if the value uses a short syntax for the
		// Array schema, if it is then replace it with the verbose syntax.
		if (Array.isArray(fieldSchema)) {
			fieldSchema = {
				type: Array,
				child: fieldSchema.map((subFieldSchema, index) =>
					this.compileSchemaField(subFieldSchema, `${fieldName}[${index}]`)
				)
			};
		}

		// If the field schema is an object and doesn't have a type
		// property, then its probably a shortcut, or incorrect syntax.
		if (
			Object.prototype.toString.apply(fieldSchema) === '[object Object]' &&
			fieldSchema.type === undefined
		) {
			fieldSchema = {
				type: Object,
				child: this.compileSchema(fieldSchema, fieldName)
			};
		}

		// Get the validator of the schema.
		const typeValidator = validators.get(fieldSchema.type);

		// If no validator was found, then throw an
		// error since its most likely an incurrect syntax.
		if (typeValidator === undefined) {
			throw Error(`Invalid type for the field "${fieldName}"`);
		}

		// Validate the compiled field schema.
		typeValidator.validateSchema(fieldSchema);

		// finaly return the compiled schema
		// (or the original if it wasen't changed)
		return fieldSchema;
	}

	/*
	 * Validates that a schema is formatted correctly
	 * and compiles shortcuts into the verbose syntax.
	 */
	compileSchema(schema = this.__schema, parentField) {
		const compiledSchema = {};

		for (const fieldName in schema) {
			// Compose a fieldname including the parent for better debuging.
			const fieldPath =
				parentField !== undefined ? parentField + '.' + fieldName : fieldName;

			// Compile the field, and save it.
			// "compiling" is needed because a field might use a shortcut.
			const compiledField = this.compileSchemaField(
				schema[fieldName],
				fieldPath
			);

			// Add to the new compiled schema.
			compiledSchema[fieldName] = compiledField;
		}

		return compiledSchema;
	}

	/*
	 * Validate a value against a field schema.
	 */
	validateProp(value, schema, propName, parentProp) {
		// Get the validator for the type of the schema.
		const validator = validators.get(schema.type);

		// Full path to the field, needed for easier debugging of nested schemas.
		const propPath =
			parentProp !== undefined ? parentProp + '.' + propName : propName;

		// If the field is required, validate that its not empty.
		if (schema.required === true) {
			// If the schema validator provided a specific
			// method for checking required fields, then use it.
			const validateRequired =
				validator.required !== undefined
					? validator.required
					: validator.validateType;

			// Bind the function to the validator object to allow `this` access.
			const fieldIsEmpty = !validateRequired.call(validator, value);

			if (fieldIsEmpty) {
				throw Error(`The field "${propPath}" is required`);
			}
		}

		// Check the the value matches an 'enum' when enum is specified.
		if (schema.enum !== undefined) {
			if (!schema.enum.includes(value)) {
				throw Error(
					`The field "${propPath}" can only be one of: ${schema.enum.join(
						', '
					)}`
				);
			}
		}

		// If the field is not undefined, then validate its type.
		// We do this check because we are iterating over the schema, not the object itself.
		if (value !== undefined) {
			const isValid = validator.validateType(value, schema);

			if (!isValid) {
				throw Error(`The field "${propPath}" is not of the correct type`);
			}
		}

		// If the field is an object then recursively run the validator on it.
		if (schema.type === Object) {
			this.validate(value, schema.child, propName);
		}

		if (schema.type === Array) {
			this.validateArray(value, schema, propName);
		}
	}

	/*
	 * Valdidates an object and all of its fields against a schema.
	 */
	validate(object, schema = this.__schema, fieldParent) {
		// Used to track which props were validated.
		const objectProps = new Set(Object.keys(object));

		// Loop over the keys in the schema(no over the object to validate).
		for (const fieldName in schema) {
			const fieldValue = object[fieldName];
			const fieldSchema = schema[fieldName];

			// Validate the prop agains its field schema.
			this.validateProp(fieldValue, fieldSchema, fieldName, fieldParent);

			// Remove the prop from the list of properties left in the object.
			objectProps.delete(fieldName);
		}

		// If there are still props in the list of properties checked
		// it means that the object has props that were not specified in the schema.
		if (objectProps.size > 0) {
			let invalidProps = Array.from(objectProps);

			// If this is a recursive call, then we append the
			// parent field name to the prop to make it easier to debug.
			if (fieldParent !== undefined) {
				invalidProps = invalidProps.map(prop => fieldParent + '.' + prop);
			}

			throw Error(
				'The object contains invalid properties: ' + invalidProps.join(', ')
			);
		}
	}

	/*
	 * Validates that an array of values matches
	 * at least one schema in an array of schemas.
	 */
	// TODO: refactor the code to be simpler.
	validateArray(array, schema, propParent) {
		// Validate the inputs.
		if (!Array.isArray(array))
			throw Error(
				`Array validator needs the first argument to be an array, instead received "${typeof array}"`
			);

		if (schema === undefined)
			throw Error(
				`Array validator needs the second argument to be the array schema, instead received "${typeof schema}"`
			);

		for (const index in array) {
			const value = array[index];
			const propName = `[${index}]`;
			let propItemMatched = false;

			for (const fieldSchema of schema.child) {
				try {
					this.validateProp(value, fieldSchema, propName, propParent);

					// If the validation didn't throw then it means
					// that the value matched the schema, we can break and move into the next array value.
					// Update the 'propItemMatched' to tell the outer loop to move into the next value.
					propItemMatched = true;
					break;
				} catch (e) {
					// Else if the validation throwed, then we need to keep checking.
					continue;
				}
			}

			// If the current propert matched a valid schema, then move into the next prop.
			if (propItemMatched) continue;

			// If no validation worked(the function would've
			// returned, and never get here), Then throw an error.
			throw Error(
				`The property "${propParent + propName}" is not of the correct type`
			);
		}
	}
}

module.exports = Schema;
