const Schema = require('../src/index');

describe('Validate Property', () => {
	test("Throws when the prop isn't of the correct type", () => {
		const schema = new Schema({});

		function validate() {
			schema.validateProp(
				[],
				{
					type: String
				},
				'propName'
			);
		}

		expect(validate).toThrow({
			propPath: 'propName',
			message: 'The field is not of the correct type'
		});
	});

	test('Throws when a prop is required but undefined', () => {
		const schema = new Schema({});

		function validate() {
			schema.validateProp(
				undefined,
				{
					type: String,
					required: true
				},
				'propName'
			);
		}

		expect(validate).toThrow({
			propPath: 'propName',
			message: 'The field is required'
		});
	});

	test("Doesn't throw when a prop is not required and is undefined", () => {
		const schema = new Schema({});

		function validate() {
			schema.validateProp(
				undefined,
				{
					type: String
				},
				'propName'
			);
		}

		expect(validate).not.toThrow();
	});

	describe('Enums', () => {
		test("Throws when the value doesn't match any option", () => {
			const schema = new Schema({});

			function validate() {
				schema.validateProp(
					'hi there!',
					{
						type: String,
						enum: ['hello', 'world?']
					},
					'propName'
				);
			}

			expect(validate).toThrow({
				propPath: 'propName',
				message: 'The field can only be one of: hello, world?'
			});
		});

		test("Doesn't throw when the field isn't required and the value is empty", () => {
			const schema = new Schema({});

			function validate() {
				schema.validateProp(
					undefined,
					{
						type: String,
						enum: ['hello', 'world?']
					},
					'propName'
				);
			}

			expect(validate).not.toThrow();
		});
	});

	test('Calls the array validator on arrays', () => {
		const schema = new Schema({});

		function validate() {
			try {
				schema.validateProp(
					['Hello', 42],
					{
						type: Array,
						child: [
							{
								type: String
							}
						]
					},
					'propName'
				);
			} catch (e) {
				return e;
			}
		}

		expect(validate()).toEqual(
			new Map([['propName[1]', 'The field is not of the correct type']])
		);
	});

	describe('Nested Objects', () => {
		test("Throws when a prop's value has incorrect type", () => {
			const schema = new Schema({});

			function validate() {
				try {
					schema.validateProp(
						{
							firstLayer: {
								name: 42
							}
						},
						{
							type: Object,
							child: {
								firstLayer: {
									type: Object,
									child: {
										name: {
											type: String
										}
									}
								}
							}
						},
						'propName'
					);
				} catch (e) {
					return e;
				}
			}

			expect(validate()).toEqual(
				new Map([['firstLayer.name', 'The field is not of the correct type']])
			);
		});

		test('Throws when a required field is undefiend', () => {
			const schema = new Schema({});

			function validate() {
				try {
					schema.validateProp(
						{
							firstLayer: {}
						},
						{
							type: Object,
							child: {
								firstLayer: {
									type: Object,
									child: {
										name: {
											type: String,
											required: true
										}
									}
								}
							}
						},
						'propName'
					);
				} catch (e) {
					return e;
				}
			}

			expect(validate()).toEqual(
				new Map([['firstLayer.name', 'The field is required']])
			);
		});
	});
});
