var Bully = exports.Bully = {};

Bully.alloc_object = function() {
  return {
    klass: null,
    iv_tbl: {}
  };
};

Bully.define_class = function(name, super) {
  var klass = Bully.alloc_object();

  klass.klass = Bully.Class;
  klass.super = super || Bully.Object;
  klass.m_tbl = {};

  return klass;
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

// bootstrap the Object and Class objects
Bully.Object = Bully.alloc_object();
Bully.Class  = Bully.alloc_object();

Bully.Object.klass = Bully.Class;
Bully.Object.super = null;
Bully.Object.m_tbl = {};

Bully.Class.klass = Bully.Class;
Bully.Class.super = Bully.Object;
Bully.Class.m_tbl = {};

Bully.define_method(Bully.Class, 'new', function(recv) {
  var o = Bully.alloc_object();
  o.klass = recv;
  return o;
});

