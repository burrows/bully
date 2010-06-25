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

exports["Bully.Class' class is Bully.Class"] = function(test) {
  test.equals(Bully.Class.klass, Bully.Class);
  test.done();
};

exports["Bully.Class' superclass is Bully.Object"] = function(test) {
  test.equals(Bully.Class.super, Bully.Object);
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

