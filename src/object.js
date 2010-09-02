/*
 * Creates the most basic instance of a Bully object.
 *
 * If passed an object, that object will be decorated with properties necessary
 * to be a Bully object, otherwise a brand new object is constructed.
 */
Bully.make_object = function(obj) {
  obj = obj || {};

  obj.klass  = null;
  obj.iv_tbl = {};

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
  Bully.define_method(Bully.Class, 'new', function(recv, args) {
    var o = Bully.make_object();
    o.klass = recv;

    //if (Bully.respond_to(o, 'initialize')) {
    //  Bully.funcall(o, 'initialize', args);
    //}

    return o;
  });

  // Kernel
  Bully.Kernel = Bully.define_module('Kernel');
  Bully.define_module_method(Bully.Kernel, 'puts', function(self, args) {
    var str = Bully.dispatch_method(args[0], 'to_s').data;
    Bully.platform.puts(str);
    return null;
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
};