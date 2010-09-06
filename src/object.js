/*
 * Creates the most basic instance of a Bully object.
 *
 * If passed an object, that object will be decorated with properties necessary
 * to be a Bully object, otherwise a brand new object is constructed.
 */
Bully.next_object_id = 0;
Bully.make_object = function(obj) {
  obj = obj || {};

  obj.klass  = null;
  obj.iv_tbl = {};
  obj.id = Bully.next_object_id++;

  return obj;
};

/*
 * Indicates whether or not an object is truthy.  In Bully, all objects are
 * truthy expect false and nil.
 */
Bully.test = function(obj) {
  return !(obj === false || obj === null);
};

/*
 * Indicates whether or not the given object is an immediate value.  An
 * immediate value is represented by a native javascript object instead of
 * being wrapped in an Object instance.  The following types of objects are
 * immediate objects:
 *   * Symbol
 *   * Number
 *   * NilClass
 *   * TrueClass
 *   * FalseClass
 */
Bully.is_immediate = function(obj) {
  var type = typeof obj;

  return type === 'string' ||
         type === 'number' ||
         obj  === null     ||
         obj  === true     ||
         obj  === false;
};

Bully.dispatch_method = function(obj, name, args) {
  var fn = Bully.find_method(Bully.class_of(obj), name);

  // TODO: check if method was actually found, call method_missing if not

  return fn.call(null, obj, args);
};

Bully.call_super = function(obj, klass, name, args) {
  var fn = Bully.find_method(klass.super, name);

  // TODO: check if method was found
  
  return fn.call(null, obj, args);
};

Bully.init = function() {
  var metaclass;

  Bully.Object = Bully.defclass_boot('Object', null);
  Bully.Module = Bully.defclass_boot('Module', Bully.Object);
  Bully.Class  = Bully.defclass_boot('Class', Bully.Module);

  metaclass = Bully.make_metaclass(Bully.Object, Bully.Class);
  metaclass = Bully.make_metaclass(Bully.Module, metaclass);
  Bully.make_metaclass(Bully.Class, metaclass);

  // Class
  Bully.define_method(Bully.Class, 'allocate', function(self, args) {
    return Bully.make_object();
  });

  Bully.define_method(Bully.Class, 'new', function(self, args) {
    var o = Bully.dispatch_method(self, 'allocate');
    o.klass = self;

    //if (Bully.respond_to(o, 'initialize')) {
    //  Bully.funcall(o, 'initialize', args);
    //}

    return o;
  });

  Bully.define_method(Bully.Class, 'name', function(self, args) {
    return Bully.str_new(Bully.ivar_get(self, '__classpath__'));
  });

  // Kernel
  Bully.Kernel = Bully.define_module('Kernel');

  Bully.define_method(Bully.Kernel, 'class', function(self, args) {
    return Bully.real_class_of(self);
  });

  Bully.define_method(Bully.Kernel, 'to_s', function(self, args) {
    var klass = Bully.real_class_of(self),
        name  = Bully.dispatch_method(klass, 'name').data;

    return Bully.str_new('#<' + name + ':' + self.id + '>');
  });

  // FIXME: properly alias this method
  Bully.define_method(Bully.Kernel, 'inspect', Bully.Kernel.m_tbl['to_s']);

  Bully.define_module_method(Bully.Kernel, 'puts', function(self, args) {
    var str = Bully.dispatch_method(args[0], 'to_s').data;
    Bully.platform.puts(str);
    return null;
  });

  Bully.define_module_method(Bully.Kernel, 'p', function(self, args) {
    var str = Bully.dispatch_method(args[0], 'inspect').data;
    Bully.platform.puts(str);
    return null;
  });

  Bully.define_module_method(Bully.Kernel, 'raise', function(self, args) {
    Bully.raise(args[0]);
  });

  Bully.define_method(Bully.Kernel, 'is_a?', function(self, args) {
    var test_klass = args[0], klass = Bully.class_of(self);

    while (klass) {
      if (test_klass === klass) { return true; }

      klass = klass.super;
    }

    return false;
  });

  // Object
  Bully.include_module(Bully.Object, Bully.Kernel);

  // NilClass
  Bully.NilClass = Bully.define_class('NilClass');
  Bully.define_method(Bully.NilClass, 'to_i', function() {
    return 0;
  });
  Bully.define_method(Bully.NilClass, 'nil?', function() {
    return true;
  });

  // main (top level self)
  Bully.main = Bully.dispatch_method(Bully.Object, 'new', []);
  Bully.define_singleton_method(Bully.main, 'to_s', function() {
    return Bully.str_new('main');
  });

  Bully.init_string();
  Bully.init_number();
  Bully.init_error();
  Bully.init_array();
};
