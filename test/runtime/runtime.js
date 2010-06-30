require.paths.unshift(__dirname + '/../../runtime');

var Bully = require('runtime').Bully;

exports["Bully.Object's class is Bully.Class"] = function(test) {
  test.equals(Bully.Object.klass, Bully.Class);
  test.done();
};

exports["Bully.Object's superclass is null"] = function(test) {
  test.equals(Bully.Object.super, null);
  test.done();
};

exports["Bully.Modules's class is Bully.Class"] = function(test) {
  test.equals(Bully.Module.klass, Bully.Class);
  test.done();
};

exports["Bully.Module's superclass is Object"] = function(test) {
  test.equals(Bully.Module.super, Bully.Object);
  test.done();
};

exports["Bully.Class' class is Bully.Class"] = function(test) {
  test.equals(Bully.Class.klass, Bully.Class);
  test.done();
};

exports["Bully.Class' superclass is Bully.Module"] = function(test) {
  test.equals(Bully.Class.super, Bully.Module);
  test.done();
};

exports["Bully.define_class returns an object whose class is Bully.Class"] = function(test) {
  var MyClass = Bully.define_class('MyClass');
  test.equals(MyClass.klass, Bully.Class);
  test.done();
};

exports["Bully.define_class returns an object whose superclass is the given class"] = function(test) {
  var Parent = Bully.define_class('Parent'),
      Child  = Bully.define_class('Child', Parent);
  test.equals(Child.super, Parent);
  test.done();
};

exports["Bully.define_class returns an object whose superclass is Bully.Object when no superclass is given"] = function(test) {
  var MyClass = Bully.define_class('MyClass');
  test.equals(MyClass.super, Bully.Object);
  test.done();
};

exports["Bully.define_class defines a constant in the global scope"] = function(test) {
  var MyClass = Bully.define_class('MyClass');

  test.equals(Bully.class_tbl['MyClass'], MyClass);

  test.done();
};

exports["Bully.define_class_under defines a constant under the given class"] = function(test) {
  var outer = Bully.define_class('Outer'),
      inner = Bully.define_class_under(outer, 'Inner');

  test.equals(Bully.class_tbl.hasOwnProperty('Inner'), false);
  test.equals(outer.iv_tbl['Inner'], inner);

  test.done();
};

exports["Bully.define_class_under defines a constant under the given module"] = function(test) {
  var outer = Bully.define_module('Outer'),
      inner = Bully.define_class_under(outer, 'Inner');

  test.equals(Bully.class_tbl.hasOwnProperty('Inner'), false);
  test.equals(outer.iv_tbl['Inner'], inner);

  test.done();
};

exports["Bully.define_module returns an object whose class is Bully.Module"] = function(test) {
  var MyModule = Bully.define_module('MyModule');
  test.equals(MyModule.klass, Bully.Module);
  test.done();
};

exports["Bully.define_module defines a constant in the global scope"] = function(test) {
  var MyModule = Bully.define_module('MyModule');
  test.equals(Bully.class_tbl['MyModule'], MyModule);
  test.done();
};

exports["Bully.define_module_under defines a constant under the given class"] = function(test) {
  var outer = Bully.define_class('Outer'),
      inner = Bully.define_module_under(outer, 'Inner');

  test.equals(Bully.class_tbl.hasOwnProperty('Inner'), false);
  test.equals(outer.iv_tbl['Inner'], inner);

  test.done();
};

exports["Bully.define_class_under defines a constant under the given module"] = function(test) {
  var outer = Bully.define_module('Outer'),
      inner = Bully.define_module_under(outer, 'Inner');

  test.equals(Bully.class_tbl.hasOwnProperty('Inner'), false);
  test.equals(outer.iv_tbl['Inner'], inner);

  test.done();
};

exports["Bully.define_method adds the given func to the class' m_tbl"] = function(test) {
  var MyClass = Bully.define_class('MyClass'),
      fn = function() {};

  Bully.define_method(MyClass, 'foo', fn);

  test.equals(MyClass.m_tbl['foo'], fn);
  test.done();
};

exports["Bully.Class.new creates a new object instance whose class is the receiver"] = function(test) {
  var c = Bully.funcall(Bully.Class, 'new');
  test.equals(c.klass, Bully.Class);
  test.done();
};

exports["Bully.lookup_method first looks for the method on the receiver's class"] = function(test) {
  var A = Bully.define_class('A'),
      a = Bully.funcall(A, 'new'),
      fn = function() {};

  Bully.define_method(A, 'foo', fn);

  test.equals(Bully.lookup_method(a, 'foo'), fn);
  test.done();
};

exports["Bully.lookup_method next looks for the method on the receiver's superclass"] = function(test) {
  var A = Bully.define_class('A'),
      B = Bully.define_class('B', A),
      b = Bully.funcall(B, 'new'),
      fn = function() {};

  Bully.define_method(A, 'foo', fn);

  test.equals(Bully.lookup_method(b, 'foo'), fn);
  test.done();
};

exports["Bully.lookup_method next looks for the method on the receiver's superclass' superclass"] = function(test) {
  var A = Bully.define_class('A'),
      B = Bully.define_class('B', A),
      C = Bully.define_class('C', B),
      c = Bully.funcall(C, 'new'),
      fn = function() {};

  Bully.define_method(A, 'foo', fn);

  test.equals(Bully.lookup_method(c, 'foo'), fn);
  test.done();
};

exports["Bully.funcall invokes the method with the given name on the given receiver"] = function(test) {
  var A = Bully.define_class('A'),
      a = Bully.funcall(A, 'new');

  Bully.define_method(A, 'me', function(recv) {
    return recv;
  });

  test.equals(Bully.funcall(a, 'me'), a);
  test.done();
};

exports["Bully.funcall invokes the method, passing it an arguments array"] = function(test) {
  var A = Bully.define_class('A'),
      a = Bully.funcall(A, 'new');

  Bully.define_method(A, 'foo', function(recv, args) {
    return args;
  });

  test.same(Bully.funcall(a, 'foo', [1, 2, 3]), [1, 2, 3]);
  test.done();
};

exports["Bully.call_super invokes the method of the given name defined on the nearest superclass of the given class"] = function(test) {
  var A = Bully.define_class('A'),    a = Bully.funcall(A, 'new'),
      B = Bully.define_class('B', A), b = Bully.funcall(B, 'new'),
      C = Bully.define_class('C', B), c = Bully.funcall(C, 'new');

  Bully.define_method(A, 'foo', function(recv) {
    return 'A#foo';
  });

  Bully.define_method(B, 'foo', function(recv) {
    return Bully.call_super(recv, B, 'foo') + ',B#foo';
  });

  Bully.define_method(C, 'foo', function(recv) {
    return Bully.call_super(recv, C, 'foo') + ',C#foo';
  });

  test.equals(Bully.funcall(a, 'foo'), 'A#foo');
  test.equals(Bully.funcall(b, 'foo'), 'A#foo,B#foo');
  test.equals(Bully.funcall(c, 'foo'), 'A#foo,B#foo,C#foo');

  test.done();
};

exports["Bully.call_super can handle skipping classes that don't define the method"] = function(test) {
  var A = Bully.define_class('A'),    a = Bully.funcall(A, 'new'),
      B = Bully.define_class('B', A), b = Bully.funcall(B, 'new'),
      C = Bully.define_class('C', B), c = Bully.funcall(C, 'new');

  Bully.define_method(A, 'foo', function(recv) {
    return 'A#foo';
  });

  Bully.define_method(C, 'foo', function(recv) {
    return Bully.call_super(recv, C, 'foo') + ',C#foo';
  });

  test.equals(Bully.funcall(a, 'foo'), 'A#foo');
  test.equals(Bully.funcall(b, 'foo'), 'A#foo');
  test.equals(Bully.funcall(c, 'foo'), 'A#foo,C#foo');

  test.done();
};

exports["Bully.ivar_set should set the given value in the given object's iv_tbl"] = function(test) {
  var o = Bully.funcall(Bully.Object, 'new');

  Bully.ivar_set(o, '@foo', 'abc');

  test.equals(o.iv_tbl['@foo'], 'abc');

  test.done();
};

exports["Bully.ivar_get should retrieve the value for the given instance variable name"] = function(test) {
  var o = Bully.funcall(Bully.Object, 'new');

  Bully.ivar_set(o, '@bar', 'xyz');

  test.equals(Bully.ivar_get(o, '@foo'));

  test.done();
};

exports["Bully.define_const adds an entry to the given class' iv_tbl"] = function(test) {
  var cls = Bully.funcall(Bully.Class, 'new');

  Bully.define_const(cls, 'MyConst', 8);

  test.equals(cls.iv_tbl['MyConst'], 8);

  test.done();
};

exports["Bully.define_global_const adds an entry to Bully.class_tbl"] = function(test) {
  Bully.define_global_const('Foobar', 'hey');
  test.equals(Bully.class_tbl['Foobar'], 'hey');
  test.done();
};

exports["Bully.const_get can access constants defined directly on a class"] = function(test) {
  var cls = Bully.funcall(Bully.Class, 'new');
  Bully.define_const(cls, 'MyConst', 4);
  test.equals(Bully.const_get(cls, 'MyConst'), 4);
  test.done();
};

exports["Bully.const_get can access constants defined on a superclass"] = function(test) {
  var A = Bully.define_class('A'),
      B = Bully.define_class('B', A);

  Bully.define_const(A, 'MyConst', 9);
  test.equals(Bully.const_get(B, 'MyConst'), 9);
  test.done();
};

exports["Bully.const_get can access constants defined on the superclass' superclass"] = function(test) {
  var A = Bully.define_class('A'),
      B = Bully.define_class('B', A);
      C = Bully.define_class('C', B);

  Bully.define_const(A, 'MyConst', 'xyz');
  test.equals(Bully.const_get(C, 'MyConst'), 'xyz');
  test.done();
};

exports["Bully.const_get can access global constants"] = function(test) {
  var A = Bully.define_class('A');

  Bully.define_global_const('MyConst', 99);
  test.equals(Bully.const_get(A, 'MyConst'), 99);
  test.done();
};

exports["Bully.const_get throws an exception if constant is not defined"] = function(test) {
  var A = Bully.define_class('A');

  test.expect(1);

  try {
    Bully.const_get(A, 'SomeUndefinedConstant');
  }
  catch (e) {
    test.equals(e, 'uninitialized constant SomeUndefinedConstant');
  }

  test.done();
};
