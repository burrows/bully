require.paths.unshift(__dirname + '/../../runtime');

var Bully = require('runtime').Bully;

Bully.init();

exports["Bully.make_object should return a new object with a null klass and empty iv_tbl"] = function(test) {
  var obj = Bully.make_object();
  test.equals(obj.hasOwnProperty('klass'), true);
  test.equals(obj.klass, null);
  test.equals(obj.hasOwnProperty('iv_tbl'), true);
  test.same(obj.iv_tbl, {});
  test.done();
};

exports["Bully.make_object should decorate an existing object when given one with a null klass and empty iv_tbl"] = function(test) {
  var origObj = [1,2,3],
      obj = Bully.make_object(origObj);
  test.equals(obj, origObj);
  test.equals(obj.hasOwnProperty('klass'), true);
  test.equals(obj.klass, null);
  test.equals(obj.hasOwnProperty('iv_tbl'), true);
  test.same(obj.iv_tbl, {});
  test.done();
};

exports["Bully.test should return false when passed null or false and true otherwise"] = function(test) {
  test.equals(Bully.test(false), false);
  test.equals(Bully.test(null), false);
  test.equals(Bully.test('a'), true);
  test.equals(Bully.test(''), true);
  test.equals(Bully.test({}), true);
  test.equals(Bully.test(0), true);
  test.equals(Bully.test(1), true);
  test.done();
};

exports["Bully.is_immediate should true for Numbers, Strings, Booleans, and null, and false otherwise"] = function(test) {
  test.equals(Bully.is_immediate(9), true);
  test.equals(Bully.is_immediate(9.1), true);
  test.equals(Bully.is_immediate(''), true);
  test.equals(Bully.is_immediate('foobar'), true);
  test.equals(Bully.is_immediate(true), true);
  test.equals(Bully.is_immediate(false), true);
  test.equals(Bully.is_immediate(null), true);
  test.equals(Bully.is_immediate({}), false);
  test.equals(Bully.is_immediate([]), false);
  test.equals(Bully.is_immediate(new Object()), false);
  test.done();
};

exports["Bully.ivar_set when given an non-immediate object should set the given name/value pair on the object's iv_tbl"] = function(test) {
  var obj = Bully.make_object();

  Bully.ivar_set(obj, 'foo', 'bar');

  test.equals(obj.iv_tbl['foo'], 'bar');

  test.done();
};

exports["Bully.ivar_set when given an immediate object should set the given name/value pair on Bully.immediate_iv_tbl"] = function(test) {
  Bully.ivar_set(123, 'a', 1);
  Bully.ivar_set('somestring', 'b', 2);
  Bully.ivar_set(true, 'c', 3);
  Bully.ivar_set(false, 'd', 4);
  Bully.ivar_set(null, 'e', 5);

  test.equals(Bully.immediate_iv_tbl[123]['a'], 1);
  test.equals(Bully.immediate_iv_tbl['somestring']['b'], 2);
  test.equals(Bully.immediate_iv_tbl[true]['c'], 3);
  test.equals(Bully.immediate_iv_tbl[false]['d'], 4);
  test.equals(Bully.immediate_iv_tbl[null]['e'], 5);

  test.done();
};

exports["Bully.ivar_get when given an non-immediate object should look up the instance variable on the object's iv_tbl"] = function(test) {
  var obj = Bully.make_object();

  Bully.ivar_set(obj, 'x', 'y');
  test.equals(Bully.ivar_get(obj, 'x'), 'y');

  test.done();
};

exports["Bully.ivar_get when given an immediate object should look up the instance variable on Bully.immediate_iv_tbl"] = function(test) {
  Bully.ivar_set(127.2, 'foo', 'bar');
  test.equals(Bully.ivar_get(127.2, 'foo'), 'bar');

  test.done();
};

exports["Bully.ivar_get should return null when the instance variable doesn't exist"] = function(test) {
  var obj = Bully.make_object();

  test.ok(Bully.ivar_get(8, 'nonexistant') === null);
  test.ok(Bully.ivar_get(obj, 'nonexistant') === null);
  test.done();
};

exports['Bully.init should bootstrap Object, Module, and Class classes'] = function(test) {
  test.ok(!Bully.Object.is_singleton);
  test.ok(Bully.Object.klass.is_singleton);
  test.ok(!Bully.Module.is_singleton);
  test.ok(Bully.Module.klass.is_singleton);
  test.ok(!Bully.Class.is_singleton);
  test.ok(Bully.Class.klass.is_singleton);

  test.equals(Bully.Object.super, null); // TODO: this will fail once Kernel is included
  test.equals(Bully.Object.klass.super, Bully.Class);
  test.equals(Bully.Module.klass.super, Bully.Object.klass);
  test.equals(Bully.Class.klass.super, Bully.Module.klass);

  test.done();
};

exports["Bully.define_class with no super should create a class whose super is Bully.Object"] = function(test) {
  var Human = Bully.define_class('Human');

  test.ok(!Human.is_singleton);
  test.ok(Human.klass.is_singleton);
  test.equals(Human.super, Bully.Object);
  test.equals(Human.klass.super, Bully.Object.klass);

  test.done();
};

exports["Bully.define_class with a super should create a class descending from super"] = function(test) {
  var Human = Bully.define_class('Human'),
      Pirate = Bully.define_class('Pirate', Human);

  test.ok(!Pirate.is_singleton);
  test.ok(Pirate.klass.is_singleton);
  test.equals(Pirate.super, Human);
  test.equals(Pirate.klass.super, Human.klass);

  test.done();
};

exports["Bully.singleton_class should create a singleton class for the object when one doesn't exist"] = function(test) {
  test.ok(false);
  test.done();
};

// exports["Bully.Object's class is Bully.Class"] = function(test) {
//   test.equals(Bully.Object.klass, Bully.Class);
//   test.done();
// };
// 
// exports["Bully.Object's superclass is null"] = function(test) {
//   test.equals(Bully.Object.super, null);
//   test.done();
// };
// 
// exports["Bully.Object#to_s should return 'Object'"] = function(test) {
//   test.equals(Bully.funcall(Bully.Object, 'to_s').data, 'Object');
//   test.done();
// };
// 
// exports["Bully.Modules's class is Bully.Class"] = function(test) {
//   test.equals(Bully.Module.klass, Bully.Class);
//   test.done();
// };
// 
// exports["Bully.Module's superclass is Object"] = function(test) {
//   test.equals(Bully.Module.super, Bully.Object);
//   test.done();
// };
// 
// exports["Bully.Module#to_s should return 'Module'"] = function(test) {
//   test.equals(Bully.funcall(Bully.Module, 'to_s').data, 'Module');
//   test.done();
// };
// 
// exports["Bully.Class' class is Bully.Class"] = function(test) {
//   test.equals(Bully.Class.klass, Bully.Class);
//   test.done();
// };
// 
// exports["Bully.Class' superclass is Bully.Module"] = function(test) {
//   test.equals(Bully.Class.super, Bully.Module);
//   test.done();
// };
// 
// exports["Bully.Class#to_s should return 'Class'"] = function(test) {
//   test.equals(Bully.funcall(Bully.Class, 'to_s').data, 'Class');
//   test.done();
// };
// 
// exports["Bully.define_class returns an object whose class is Bully.Class"] = function(test) {
//   var MyClass = Bully.define_class('MyClass');
//   test.equals(MyClass.klass, Bully.Class);
//   test.done();
// };
// 
// exports["Bully.define_class returns an object whose superclass is the given class"] = function(test) {
//   var Parent = Bully.define_class('Parent'),
//       Child  = Bully.define_class('Child', Parent);
//   test.equals(Child.super, Parent);
//   test.done();
// };
// 
// exports["Bully.define_class returns an object whose superclass is Bully.Object when no superclass is given"] = function(test) {
//   var MyClass = Bully.define_class('MyClass');
//   test.equals(MyClass.super, Bully.Object);
//   test.done();
// };
// 
// exports["Bully.define_class defines a constant in the global scope"] = function(test) {
//   var MyClass = Bully.define_class('MyClass');
// 
//   test.equals(Bully.class_tbl['MyClass'], MyClass);
// 
//   test.done();
// };
// 
// exports["Bully.define_class_under defines a constant under the given class"] = function(test) {
//   var outer = Bully.define_class('Outer'),
//       inner = Bully.define_class_under(outer, 'Inner');
// 
//   test.equals(Bully.class_tbl.hasOwnProperty('Inner'), false);
//   test.equals(outer.iv_tbl['Inner'], inner);
// 
//   test.done();
// };
// 
// exports["Bully.define_class_under defines a constant under the given module"] = function(test) {
//   var outer = Bully.define_module('Outer'),
//       inner = Bully.define_class_under(outer, 'Inner');
// 
//   test.equals(Bully.class_tbl.hasOwnProperty('Inner'), false);
//   test.equals(outer.iv_tbl['Inner'], inner);
// 
//   test.done();
// };
// 
// exports["Bully.define_module returns an object whose class is Bully.Module"] = function(test) {
//   var MyModule = Bully.define_module('MyModule');
//   test.equals(MyModule.klass, Bully.Module);
//   test.done();
// };
// 
// exports["Bully.define_module defines a constant in the global scope"] = function(test) {
//   var MyModule = Bully.define_module('MyModule');
//   test.equals(Bully.class_tbl['MyModule'], MyModule);
//   test.done();
// };
// 
// exports["Bully.define_module_under defines a constant under the given class"] = function(test) {
//   var outer = Bully.define_class('Outer'),
//       inner = Bully.define_module_under(outer, 'Inner');
// 
//   test.equals(Bully.class_tbl.hasOwnProperty('Inner'), false);
//   test.equals(outer.iv_tbl['Inner'], inner);
// 
//   test.done();
// };
// 
// exports["Bully.define_class_under defines a constant under the given module"] = function(test) {
//   var outer = Bully.define_module('Outer'),
//       inner = Bully.define_module_under(outer, 'Inner');
// 
//   test.equals(Bully.class_tbl.hasOwnProperty('Inner'), false);
//   test.equals(outer.iv_tbl['Inner'], inner);
// 
//   test.done();
// };
// 
// exports["Bully.define_method adds the given func to the class' m_tbl"] = function(test) {
//   var MyClass = Bully.define_class('MyClass'),
//       fn = function() {};
// 
//   Bully.define_method(MyClass, 'foo', fn);
// 
//   test.equals(MyClass.m_tbl['foo'], fn);
//   test.done();
// };
// 
// exports["Bully.Class.new creates a new object instance whose class is the receiver"] = function(test) {
//   var c = Bully.funcall(Bully.Class, 'new');
//   test.equals(c.klass, Bully.Class);
//   test.done();
// };
// 
// exports["Bully.Class.new calls the initalize method if the object responds to it, passing the arguments passed to new"] = function(test) {
//   var A = Bully.define_class('A'), a;
// 
//   Bully.define_method(A, 'initialize', function(recv, args) {
//     Bully.ivar_set(recv, '@foo', args);
//   });
// 
//   a = Bully.funcall(A, 'new', ['a', 'b', 'c']);
// 
//   test.same(Bully.ivar_get(a, '@foo'), ['a', 'b', 'c']);
// 
//   test.done();
// };
// 
// exports["Bully.lookup_method first looks for the method on the receiver's class"] = function(test) {
//   var A = Bully.define_class('A'),
//       a = Bully.funcall(A, 'new'),
//       fn = function() {};
// 
//   Bully.define_method(A, 'foo', fn);
// 
//   test.equals(Bully.lookup_method(a, 'foo'), fn);
//   test.done();
// };
// 
// exports["Bully.lookup_method next looks for the method on the receiver's superclass"] = function(test) {
//   var A = Bully.define_class('A'),
//       B = Bully.define_class('B', A),
//       b = Bully.funcall(B, 'new'),
//       fn = function() {};
// 
//   Bully.define_method(A, 'foo', fn);
// 
//   test.equals(Bully.lookup_method(b, 'foo'), fn);
//   test.done();
// };
// 
// exports["Bully.lookup_method next looks for the method on the receiver's superclass' superclass"] = function(test) {
//   var A = Bully.define_class('A'),
//       B = Bully.define_class('B', A),
//       C = Bully.define_class('C', B),
//       c = Bully.funcall(C, 'new'),
//       fn = function() {};
// 
//   Bully.define_method(A, 'foo', fn);
// 
//   test.equals(Bully.lookup_method(c, 'foo'), fn);
//   test.done();
// };
// 
// exports["Bully.respond_to returns true if the given object responds to the given message name and false otherwise"] = function(test) {
//   var A = Bully.define_class('A'),
//       a = Bully.funcall(A, 'new');
// 
//   Bully.define_method(A, 'hello', function() {});
// 
//   test.equals(Bully.respond_to(a, 'hello'), true);
//   test.equals(Bully.respond_to(a, 'no_method'), false);
// 
//   test.done();
// };
// 
// exports["Bully.funcall invokes the method with the given name on the given receiver"] = function(test) {
//   var A = Bully.define_class('A'),
//       a = Bully.funcall(A, 'new');
// 
//   Bully.define_method(A, 'me', function(recv) {
//     return recv;
//   });
// 
//   test.equals(Bully.funcall(a, 'me'), a);
//   test.done();
// };
// 
// exports["Bully.funcall invokes the method, passing it an arguments array"] = function(test) {
//   var A = Bully.define_class('A'),
//       a = Bully.funcall(A, 'new');
// 
//   Bully.define_method(A, 'foo', function(recv, args) {
//     return args;
//   });
// 
//   test.same(Bully.funcall(a, 'foo', [1, 2, 3]), [1, 2, 3]);
//   test.done();
// };
// 
// exports["Bully.call_super invokes the method of the given name defined on the nearest superclass of the given class"] = function(test) {
//   var A = Bully.define_class('A'),    a = Bully.funcall(A, 'new'),
//       B = Bully.define_class('B', A), b = Bully.funcall(B, 'new'),
//       C = Bully.define_class('C', B), c = Bully.funcall(C, 'new');
// 
//   Bully.define_method(A, 'foo', function(recv) {
//     return 'A#foo';
//   });
// 
//   Bully.define_method(B, 'foo', function(recv) {
//     return Bully.call_super(recv, B, 'foo') + ',B#foo';
//   });
// 
//   Bully.define_method(C, 'foo', function(recv) {
//     return Bully.call_super(recv, C, 'foo') + ',C#foo';
//   });
// 
//   test.equals(Bully.funcall(a, 'foo'), 'A#foo');
//   test.equals(Bully.funcall(b, 'foo'), 'A#foo,B#foo');
//   test.equals(Bully.funcall(c, 'foo'), 'A#foo,B#foo,C#foo');
// 
//   test.done();
// };
// 
// exports["Bully.call_super can handle skipping classes that don't define the method"] = function(test) {
//   var A = Bully.define_class('A'),    a = Bully.funcall(A, 'new'),
//       B = Bully.define_class('B', A), b = Bully.funcall(B, 'new'),
//       C = Bully.define_class('C', B), c = Bully.funcall(C, 'new');
// 
//   Bully.define_method(A, 'foo', function(recv) {
//     return 'A#foo';
//   });
// 
//   Bully.define_method(C, 'foo', function(recv) {
//     return Bully.call_super(recv, C, 'foo') + ',C#foo';
//   });
// 
//   test.equals(Bully.funcall(a, 'foo'), 'A#foo');
//   test.equals(Bully.funcall(b, 'foo'), 'A#foo');
//   test.equals(Bully.funcall(c, 'foo'), 'A#foo,C#foo');
// 
//   test.done();
// };
// 
// exports["Bully.ivar_set should set the given value in the given object's iv_tbl"] = function(test) {
//   var o = Bully.funcall(Bully.Object, 'new');
// 
//   Bully.ivar_set(o, '@foo', 'abc');
// 
//   test.equals(o.iv_tbl['@foo'], 'abc');
// 
//   test.done();
// };
// 
// exports["Bully.ivar_get should retrieve the value for the given instance variable name"] = function(test) {
//   var o = Bully.funcall(Bully.Object, 'new');
// 
//   Bully.ivar_set(o, '@bar', 'xyz');
// 
//   test.equals(Bully.ivar_get(o, '@foo'));
// 
//   test.done();
// };
// 
// exports["Bully.define_const adds an entry to the given class' iv_tbl"] = function(test) {
//   var cls = Bully.funcall(Bully.Class, 'new');
// 
//   Bully.define_const(cls, 'MyConst', 8);
// 
//   test.equals(cls.iv_tbl['MyConst'], 8);
// 
//   test.done();
// };
// 
// exports["Bully.define_global_const adds an entry to Bully.class_tbl"] = function(test) {
//   Bully.define_global_const('Foobar', 'hey');
//   test.equals(Bully.class_tbl['Foobar'], 'hey');
//   test.done();
// };
// 
// exports["Bully.const_get can access constants defined directly on a class"] = function(test) {
//   var cls = Bully.funcall(Bully.Class, 'new');
//   Bully.define_const(cls, 'MyConst', 4);
//   test.equals(Bully.const_get(cls, 'MyConst'), 4);
//   test.done();
// };
// 
// exports["Bully.const_get can access constants defined on a superclass"] = function(test) {
//   var A = Bully.define_class('A'),
//       B = Bully.define_class('B', A);
// 
//   Bully.define_const(A, 'MyConst', 9);
//   test.equals(Bully.const_get(B, 'MyConst'), 9);
//   test.done();
// };
// 
// exports["Bully.const_get can access constants defined on the superclass' superclass"] = function(test) {
//   var A = Bully.define_class('A'),
//       B = Bully.define_class('B', A);
//       C = Bully.define_class('C', B);
// 
//   Bully.define_const(A, 'MyConst', 'xyz');
//   test.equals(Bully.const_get(C, 'MyConst'), 'xyz');
//   test.done();
// };
// 
// exports["Bully.const_get can access global constants"] = function(test) {
//   var A = Bully.define_class('A');
// 
//   Bully.define_global_const('MyConst', 99);
//   test.equals(Bully.const_get(A, 'MyConst'), 99);
//   test.done();
// };
// 
// exports["Bully.const_get when passed null as the first argument will simply look up a global constant"] = function(test) {
//   var A = Bully.define_class('A');
// 
//   Bully.define_global_const('MyConst', 99);
//   test.equals(Bully.const_get(null, 'MyConst'), 99);
//   test.done();
// };
// 
// exports["Bully.const_get throws an exception if constant is not defined"] = function(test) {
//   var A = Bully.define_class('A');
// 
//   test.expect(1);
// 
//   try {
//     Bully.const_get(A, 'SomeUndefinedConstant');
//   }
//   catch (e) {
//     test.equals(e, 'uninitialized constant SomeUndefinedConstant');
//   }
// 
//   test.done();
// };
// 
// exports["Bully.define_class should set the class' classpath"] = function(test) {
//   var A = Bully.define_class('A'),
//       B = Bully.define_class_under(A, 'B'),
//       C = Bully.define_class_under(B, 'C');
// 
//   test.equals(Bully.funcall(A, 'to_s').data, 'A');
//   test.equals(Bully.funcall(B, 'to_s').data, 'A::B');
//   test.equals(Bully.funcall(C, 'to_s').data, 'A::B::C');
//   test.done();
// };
// 
// exports["Bully.define_module should set the modules' classpath"] = function(test) {
//   var A = Bully.define_module('A'),
//       B = Bully.define_module_under(A, 'B'),
//       C = Bully.define_module_under(B, 'C');
// 
//   test.equals(Bully.funcall(A, 'to_s').data, 'A');
//   test.equals(Bully.funcall(B, 'to_s').data, 'A::B');
//   test.equals(Bully.funcall(C, 'to_s').data, 'A::B::C');
//   test.done();
// };
