/*
Copyright (c) 2011 Cimaron Shanahan

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
CONNECTION WITH THE SOFTWARE OR THE USE		 OR OTHER DEALINGS IN THE SOFTWARE.
*/

(function(glsl) {
	var objCode;
	objCode = glsl.objCode;

	//Type qualifier global variables
	var g_type_qualifiers = [];
	g_type_qualifiers[glsl.ast.type_qualifier.flags.attribute] = 'attribute';
	g_type_qualifiers[glsl.ast.type_qualifier.flags.uniform] = 'uniform';
	g_type_qualifiers[glsl.ast.type_qualifier.flags.out] = 'out';
	g_type_qualifiers[glsl.ast.type_qualifier.flags.varying] = 'varying';

	//Autogenerated
	var g_operation_table = {"3":{"1":{"1":0},"6":{"6":1},"7":{"7":2}},"4":{"1":{"1":3},"7":{"7":4}},"5":{"1":{"1":5},"6":{"1":6,"6":7},"7":{"7":8},"21":{"6":9},"25":{"7":10,"25":11}},"6":{"1":{"1":12}},"23":{"4":13},"40":14,"41":15};

	var g_operation_functions = ["float (%s+%s)","vec3 vec3.add(%s,%s)","vec4 vec4.add(%s,%s)","float (%s-%s)","vec4 vec4.sub(%s,%s)","float (%s*%s)","vec3 vec3.scale(%s,%s)","vec3 vec3.multiply(%s,%s)","vec4 vec4.multiply(%s,%s)","vec3 mat3.multiplyVec3(%s,%s)","vec4 mat4.multiplyVec4(%s,%s)","mat4 mat4.multiply(%s,%s)","float (%s\/%s)","bool !(%s)","any %s[%s]","any %s(%s)"];

	var g_operations_field_selection_names = {
		"5" : [ 'xy', 'rg', 'st' ],
		"6" : [ 'xyz', 'rgb', 'stp' ],
		"7" : [ 'xyzw', 'rgba', 'stpq' ]
	};

	/**
	 * Returns a code block for an operation
	 *
	 * @return  objCode;
	 */
	function get_operation() {
		var table, next, code;

		table = Array.prototype.shift.apply(arguments);
		if (typeof table == "number") {
			next = table;
			table = g_operation_table;
		} else {
			next = Array.prototype.shift.apply(arguments);
		}

		if (typeof table[next] == 'undefined') {
			return false;
		}

		if (typeof table[next] == "number") {
			next = table[next];
			code = g_operation_functions[next].split(' ');
			return new objCode(code[1], glsl.type[code[0]]);
		}

		Array.prototype.unshift.call(arguments, table[next]);
		return get_operation.apply(this, arguments);
	}

	/**
	 * Returns a code block for a right side field selection
	 *
	 * @identifier  string  name of vector
	 * @fields      string  fields to select
	 * @type        int     type of source vector
	 *
	 * @return  objCode;
	 */
	function get_field_selection_r_type(identifier, fields, type) {
		var code, i, j, sets, set, keys;

		fields = fields.split('');

		//invalid number of field selections
		if (fields.length < 1 || fields.length > 4) {
			return false;
		}

		//find a field set based on the first field
		sets = g_operations_field_selection_names[type];
		for (i in sets) {
			if (sets[i].indexOf(fields[0]) != -1) {
				set = sets[i];
				break;
			}
		}
		if (!set) {
			return false;
		}

		keys = [];
		for (i = 0; i < fields.length; i++) {
			j = set.indexOf(fields[i]);
			if (j == -1) {
				return false;	
			}
			keys[i] = glsl.sprintf('%s[%s]', identifier, j);
		}

		if (keys.length == 1) {
			code = new objCode(keys[0], glsl.type.float);
		} else {
			code = new objCode("[%s]", glsl.type['vec' + keys.length]);
			code.apply(keys.join(","));
		}

		return code;
	}

	/**
	 * Returns indentation for the current scope
	 *
	 * @return  string
	 */
	function g_indent() {
		return new Array(glsl.generator.depth + 1).join("\t");
	}

	//-------------------------------------------------
	//	Code Generation
	//-------------------------------------------------

	/**
	 * Constructs a type specifier code block
	 *
	 * @param   ast_node    ast_node that represents a type specifier
	 *
	 * @return  objCode
	 */
	function type_specifier(ts) {
		if (ts.is_precision_statement) {
			return new objCode();
		}
		throw new Error(g_error('Cannot generate type specifier', ts));
	}

	/**
	 * Constructs a declaration list code block
	 *
	 * @param   ast_node    ast_node that represents a declaration list
	 *
	 * @return  objCode
	 */
	function declarator_list(dl) {
		var code, type, defCode, i, decl, name, entry, decCode, expCode;

		code = new objCode();

		//get default initialization values
		type = dl.type;
		defCode = glsl.type.defaultValues[type.specifier.type_specifier];

		for (i = 0; i < dl.declarations.length; i++) {

			decl = dl.declarations[i];
			name = decl.identifier;

			//add symbol table entry
			entry = glsl.state.symbols.add_variable(name);
			entry.type = type.specifier.type_specifier;

			if (type.qualifier) {

				entry.qualifier_name = g_type_qualifiers[type.qualifier.flags.q];
			
			} else {
				decCode = new objCode("var %s = %s;");
				if (decl.initializer) {
					expCode = expression(decl.initializer);
					if (expCode.type != entry.type) {
						throw new Error(g_error("Could not assign value of type " + expCode.type_name + " to " + glsl.type.names[entry.type], dl));
					}
				} else {
					expCode = defCode;
				}
				decCode.apply(entry.name, expCode);
				code.addLine(decCode);
			}
		}

		return code;
	}

	/**
	 * Constructs a function header code block
	 *
	 * @param   ast_node    ast_node that represents an operator expression
	 *
	 * @return  objCode
	 */
	function g_function(f) {
		var code, params, param, i, name, entry;

		//generate param list
		params = [];
		for (i = 0; i < f.parameters.length; i++) {
			param = f.parameters[i];
			if (param.is_void) {
				return '';
			}
			params.push(param.identifier);
		}
		params = params.join(", ");

		//generate 
		name = f.identifier;
		entry = glsl.state.symbols.get_function(name);

		code = new objCode("function %s(%s)");
		code.apply(entry.object_name, params);

		return code;
	}

	/**
	 * Constructs a type constructor
	 *
	 * @param   ast_node    ast_node that represents a constructor operation
	 *
	 * @return  objCode
	 */
	function constructor(con, c) {
		var code, i, j, l, e, list, e2;

		list = [];
		for (i = 0; i < c.length; i++) {

			e = expression(c[i]);
			l = glsl.type.size[e.type];

			if (l == 1) {
				//simple variable
				list.push(e.code);	
			
			} else {
				//vector or matrix
				for (j = 0; j < l; j++) {
					e2 = new objCode("%s[%s]");
					e2.apply(e.code, j);
					list.push(e2.code);
				}
			}
		}

		l = glsl.type.size[con.type];
		if (list.length > l) {
			list = list.slice(0, l);	
		}
		if (list.length < l) {
			throw new Error(g_error("Not enough parameters to constructor", con));
		}

		//code = new objCode("(new Float32Array([%s]))", con.type);
		code = new objCode("([%s])", con.type);
		code.apply(list.join(","));
		
		return code;
	}

	/**
	 * Constructs an operator expression code block
	 *
	 * @param   ast_node    ast_node that represents an operator expression
	 *
	 * @return  objCode
	 */
	function expression_op(e) {
		var code, se, se1, se2, se3, i, entry, se_types, se_type_names, op_name;

		if (se = e.subexpressions) {
			se1 = expression(se[0]);
			se2 = expression(se[1]);
			se3 = expression(se[2]);
		}
		
		op_name = glsl.ast.op_names[e.oper];

		switch (e.oper) {

			//simple expression
			case glsl.ast.operators.int_constant:
			case glsl.ast.operators.float_constant:
			case glsl.ast.operators.identifier:

				code = expression_simple(e);
				break;

			//assignment operator
			case glsl.ast.operators.assign:

				if (se1.type != se2.type) {
					throw new Error(g_error("Could not assign value of type " + se2.type_name + " to " + se1.type_name, e));
				}

				//@todo:
				//check that se1 is a valid type for assignment
				//if se1 has a quantifier, generate that
				
				code = new objCode("%s = %s", se2.type);
				code.apply(se1, se2);
				break;

			//normal unary operator
			case glsl.ast.operators.logic_not:

				code = get_operation(e.oper, se1.type);
				if (!code) {
					throw new Error(g_error("Could not apply operation " + op_name + " to " + se1.type_name, e));
				}
				code.apply(se1);
				break;

			//normal binary operator
			case glsl.ast.operators.add:
			case glsl.ast.operators.sub:
			case glsl.ast.operators.mul:
			case glsl.ast.operators.div:

				code = get_operation(e.oper, se1.type, se2.type);
				if (!code) {
					throw new Error(g_error("Cannot apply operation " + op_name + " to " + se1.type_name + " and " + se2.type_name, e));
				}
				code.apply(se1, se2);
				break;

			case glsl.ast.operators.array_index:
			
				if (se2.type != glsl.type.int) {
					throw new Error(g_error("Invalid array index type: " + se2.type_name, e));
				}

				entry = glsl.state.symbols.get_variable(se[0].primary_expression.identifier);

				//need to add check that variable is an array
				//throw new Error(glsl.sprintf("Variable %s is not an array", se[0].primary_expression.identifier));

				code = get_operation(e.oper);
				code.type = entry.type;
				code.apply(se1, se2);
				break;

			//function call
			case glsl.ast.operators.function_call:

				if (e.cons) {
					code = constructor(se1, e.expressions);
				} else {
					//@todo: check types of parameters
					se3 = [];
					se_types = [];
					se_type_names = [];
					for (i = 0; i < e.expressions.length; i++) {
						se2 = expression(e.expressions[i]);
						se3.push(se2);
						se_types.push(se2.type);
						se_type_names.push(se2.type_name);
					}
					se3 = se3.join(',');

					entry = glsl.state.symbols.get_function(se[0].primary_expression.identifier, null, se_types);
					if (!entry) {
						throw new Error("Function " + se[0].primary_expression.identifier + "(" + se_type_names.join(",") + ") not found");
					}				
					
					code = get_operation(e.oper, null);
					code.type = entry.type;
					code.apply(se1, se3);
				}
				break;

			case glsl.ast.operators.field_selection:

				code = get_field_selection_r_type(se1, e.primary_expression.identifier, se1.type);
				if (!code) {
					throw new Error(g_error("Invalid field selection " + se1 + "." + e.primary_expression.identifier, e));
				}
				break;

			default:
				throw new Error(g_error("Could not translate unknown expression " + e.typeOf() + '(' + e.oper + ')', e));
		}

		return code;
	}

	/**
	 * Constructs a simple expression code block
	 *
	 * @param   ast_node    ast_node that represents a simple expression
	 *                      (either an identifier or a single value)
	 *
	 * @return  objCode
	 */
	function expression_simple(e) {
		var code, name, entry;

		//identifier
		if (e.primary_expression.identifier) {

			//lookup identifier in symbol table
			name = e.primary_expression.identifier;
			entry = glsl.state.symbols.get_variable(name);

			if (!entry || !entry.type) {
				throw new Error(g_error(name + " is undefined", e));
			}
			
			//global vs local scope
			if (entry.depth == 0) {
				code = new objCode(entry.object_name, entry.type);
			} else {
				code = new objCode(name, entry.type);
			}

			return code;
		}

		//float constant
		if (typeof e.primary_expression.float_constant != 'undefined') {
			code = new objCode(String(e.primary_expression.float_constant), glsl.type.float);
			return code;
		}

		//int constant
		if (typeof e.primary_expression.int_constant != 'undefined') {
			code = new objCode(String(e.primary_expression.int_constant), glsl.type.int);
			return code;
		}

		throw new Error(g_error("Cannot translate unkown simple expression type", e));
	}

	/**
	 * Constructs an expression code block
	 *
	 * @param   ast_node    ast_node that represents an expression
	 *
	 * @return  objCode
	 */
	function expression(e) {
		var code;

		if (!e) {
			return;	
		}

		//operator
		if (typeof e.oper == 'number') {
			code = expression_op(e);
			return code;
		}

		//simple (variable, or value)
		if (e.primary_expression) {
			code = expression_simple(e);
			return code;
		}

		//cast
		if (e.typeOf('ast_type_specifier')) {
			code = new objCode(null, e.type_specifier);
			return code;
		}

		throw new Error(g_error("Could not translate unknown expression type", e));
	}

	/**
	 * Constructs a compound statement code block
	 *
	 * @param   ast_node    ast_node that represents a compound statement type
	 *
	 * @return  objCode
	 */
	function compound_statement(cs) {
		var code, start, node, stmt, code1, code2, code3, code4;

		code = new objCode();
		code.addLine("{");

		glsl.state.symbols.push_scope();
		glsl.generator.depth++;

		node = cs.statements.head;
		start = null;

		while (node != start) {

			stmt = node.data;

			switch (stmt.typeOf()) {

				case 'ast_expression_statement':
					code1 = expression(stmt.expression);
					code1.addCode(";");
					break;

				case 'ast_declarator_list':
					code1 = declarator_list(stmt);
					code1.addCode(";");
					break;

				case 'ast_selection_statement':
					code1 = new objCode("if(%s)%s");

					//should we add a check that condition is bool type?
					code2 = expression(stmt.condition);
					code3 = compound_statement(stmt.then_statement);
					if (stmt.else_statement) {
						code4 = compound_statement(stmt.else_statement);
						code1.addLine("else%s");
					}
					code1.apply(code2, code3, code4);
					break;

				default:
					throw new Error(g_error("Could not translate statement type (" + stmt.typeOf() + ")", stmt));
			}

			code.addLine(code1);

			if (!start) {
				start = node;
			}
			node = node.next;
		}

		glsl.state.symbols.pop_scope();
		glsl.generator.depth--;
		code.addLine("}");

		return code;
	}

	/**
	 * Constructs a function definition block
	 *
	 * @param   ast_node    ast_node that represents a function definition
	 *
	 * @return  objCode
	 */
	function function_definition(fd) {
		var code, b_code;

		code = new objCode();

		if (fd.is_definition) {
			code.addCode("\n");
			return code;
		}

		code.addLine(g_function(fd.proto_type));
		code.addLine(compound_statement(fd.body));

		return code;
	}

	/**
	 * Constructs a translation unit
	 *
	 * @param   ast_node    ast_node that represents a translation unit
	 *
	 * @return  objCode
	 */
	function translation_unit(tu) {
		switch (tu.typeOf()) {
			case 'ast_declarator_list':
				return declarator_list(tu);
			case 'ast_type_specifier':
				return type_specifier(tu);
			case 'ast_function_definition':
				return function_definition(tu);
			default:
				throw new Error(g_error('Invalid translation unit node', tu));
		}
	}

	/**
	 * Constructs an error message
	 *
	 * @param   string      The error message
	 * @param   ast_node    The error ast_node
	 *
	 * @return  string
	 */
	function g_error(msg, n) {
		if (n && n.location) {
			msg += " at line " + n.location.line + ", column " + n.location.column;	
		}
		return msg;
	}
	
	//-----------------------------------------------------------
	//External interface

	glsl.generator = {
		
		depth : 0,

		output : '',
		status : false,
		errors : [],

		/**
		 * Constructs a program's object code from an ast and symbol table
		 *
		 * @param   string      The error message
		 * @param   ast_node    The error ast_node
		 *
		 * @return  string
		 */
		createObjectCode : function(state) {
			var code;

			//initialize
			this.output = '';
			this.status = false;
			this.errors = [];

			try {
				code = new objCode();
				for (i = 0; i < state.translation_unit.length; i++) {
					code.addLine(translation_unit(state.translation_unit[i]));
				}
			} catch (e) {
				this.errors.push(e);
				throw e;
				//return false;
			}

			this.output += code;

			this.status = true;
			return true;
		}		
	};

}(glsl));

