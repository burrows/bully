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

  return klass;
};

Bully.define_class_under = function(outer, name, super) {
  var klass = Bully.create_class(super);

  Bully.define_const(outer, name, klass);

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

  return mod;
};

Bully.define_module_under = function(outer, name, super) {
  var mod = Bully.create_module();

  Bully.define_const(outer, name, mod);

  return mod;
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

Bully.funcall = function(recv, name) {
  var fn = Bully.lookup_method(recv, name);
  return fn.apply(null, [recv]);
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

// bootstrap the Object, Module and Class classes
Bully.Object = Bully.alloc_object();
Bully.Module = Bully.alloc_object();
Bully.Class  = Bully.alloc_object();

Bully.Object.klass = Bully.Class;
Bully.Object.super = null;
Bully.Object.m_tbl = {};

Bully.Module.klass = Bully.Class;
Bully.Module.super = Bully.Object;
Bully.Module.m_tbl = {};

Bully.Class.klass = Bully.Class;
Bully.Class.super = Bully.Module;
Bully.Class.m_tbl = {};

Bully.define_method(Bully.Class, 'new', function(recv) {
  var o = Bully.alloc_object();
  o.klass = recv;
  return o;
});

