var Bully = exports.Bully = {};

Bully.alloc_object = function() {
  return {
    klass: null,
    iv_tbl: {}
  };
};

Bully.create_class = function(super) {
  var klass = Bully.alloc_object();

  klass.klass = Bully.Class;
  klass.super = super || Bully.Object;
  klass.m_tbl = {};

  return klass;
};

Bully.define_class = function(name, super) {
  var klass = Bully.create_class(super);

  Bully.define_global_const(name, klass);
  Bully.set_class_path(klass, null, name);

  return klass;
};

Bully.define_class_under = function(outer, name, super) {
  var klass = Bully.create_class(super);

  Bully.define_const(outer, name, klass);
  Bully.set_class_path(klass, outer, name);

  return klass;
};

Bully.create_module = function() {
  var mod = Bully.alloc_object();

  mod.klass = Bully.Module;
  mod.m_tbl = {};

  return mod;
};

Bully.define_module = function(name) {
  var mod = Bully.create_module();

  Bully.define_global_const(name, mod);
  Bully.set_class_path(mod, null, name);

  return mod;
};

Bully.define_module_under = function(outer, name, super) {
  var mod = Bully.create_module();

  Bully.define_const(outer, name, mod);
  Bully.set_class_path(mod, outer, name);

  return mod;
};

Bully.class_path = function(klass) {
  return Bully.ivar_get(klass, '__classpath__');
};

Bully.set_class_path = function(klass, under, name) {
  if (under) {
    name = Bully.class_path(under).data + '::' + name;
  }

  Bully.ivar_set(klass, '__classpath__', Bully.str_new(name));
};

Bully.define_method = function(klass, name, fn) {
  klass.m_tbl[name] = fn;
};

Bully.lookup_method = function(recv, name) {
  var klass = recv.klass;

  while (klass && !klass.m_tbl[name]) {
    klass = klass.super;
  }

  return klass ? klass.m_tbl[name] : null;
};

Bully.respond_to = function(obj, name) {
  return !!Bully.lookup_method(obj, name);
};

Bully.funcall = function(recv, name, args) {
  var fn = Bully.lookup_method(recv, name);
  return fn.apply(null, [recv, args]);
};

Bully.call_super = function(recv, klass, name) {
  do {
    klass = klass.super;
  } while (klass && !klass.m_tbl[name]);

  return klass.m_tbl[name].apply(null, [recv]);
};

Bully.ivar_set = function(obj, name, val) {
  obj.iv_tbl[name] = val;
};

Bully.ivar_get = function(obj, name) {
  return obj.iv_tbl[name];
};

Bully.define_const = function(klass, name, val) {
  klass.iv_tbl[name] = val;
};

Bully.class_tbl = {};
Bully.define_global_const = function(name, val) {
  Bully.class_tbl[name] = val;
};

Bully.const_get = function(klass, name) {
  var found = false, val;
  do {
    if (klass.iv_tbl.hasOwnProperty(name)) {
      found = true;
      val = klass.iv_tbl[name];
    }
    else {
      klass = klass.super;
    }
  } while (!found && klass.super);

  if (!found && Bully.class_tbl.hasOwnProperty(name)) {
    val = Bully.class_tbl[name];
    found = true;
  }

  if (!found) { throw "uninitialized constant " + name; }

  return val;
};

// bootstrap the basic types
Bully.Object = Bully.alloc_object();
Bully.Module = Bully.alloc_object();
Bully.Class  = Bully.alloc_object();
Bully.String = Bully.alloc_object();

Bully.Object.klass = Bully.Class;
Bully.Object.super = null;
Bully.Object.m_tbl = {};
Bully.define_global_const('Object', Bully.Object);

Bully.Module.klass = Bully.Class;
Bully.Module.super = Bully.Object;
Bully.Module.m_tbl = {};
Bully.define_global_const('Module', Bully.Module);

Bully.Class.klass = Bully.Class;
Bully.Class.super = Bully.Module;
Bully.Class.m_tbl = {};
Bully.define_global_const('Class', Bully.Class);

Bully.String.klass = Bully.Class;
Bully.String.super = null;
Bully.String.m_tbl = {};
Bully.define_global_const('String', Bully.String);

// Class class methods
Bully.define_method(Bully.Class, 'new', function(recv, args) {
  var o = Bully.alloc_object();
  o.klass = recv;

  if (Bully.respond_to(o, 'initialize')) {
    Bully.funcall(o, 'initialize', args);
  }

  return o;
});

// Module class methods
Bully.define_method(Bully.Module, 'to_s', function(recv) {
  return Bully.ivar_get(recv, '__classpath__');
});

// String class
Bully.str_new = function(js_str) {
  var o = Bully.alloc_object();
  o.klass = Bully.String;
  o.data = js_str;
  return o;
};

Bully.str_cat = function(str, js_str) {
  str.data += js_str;
  return str;
};

Bully.define_method(Bully.String, '<<', function(recv, args) {
  Bully.str_cat(recv, args[0].data);
  return recv;
});

// Array class
Bully.Array = Bully.define_class('Array');

Bully.ary_new = function() {
  var o = Bully.alloc_object();
  o.klass = Bully.Array;
  o.data = [];
  return o;
};

Bully.define_method(Bully.Array, 'push', function(recv, args) {
  Array.prototype.push.apply(recv.data, args);
  return recv;
});

Bully.set_class_path(Bully.Object, null, 'Object');
Bully.set_class_path(Bully.Module, null, 'Module');
Bully.set_class_path(Bully.Class, null, 'Class');
Bully.set_class_path(Bully.String, null, 'String');
