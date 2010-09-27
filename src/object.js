/*
 * Creates the most basic instance of a Bully object.
 *
 * If passed an object, that object will be decorated with properties necessary
 * to be a Bully object, otherwise a brand new object is constructed.
 */
Bully.next_object_id = 8;
Bully.make_object = function(obj, klass) {
  obj   = obj   || {};
  klass = klass || null;

  obj.klass  = klass;
  obj.iv_tbl = {};
  obj.id     = Bully.next_object_id;

  Bully.next_object_id += 4;

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
 * immediate value is represented by a native javascript value instead of
 * being wrapped in an Object instance.  The following types of objects are
 * immediate objects:
 *   * Symbol
 *   * Fixnum
 *   * NilClass
 *   * TrueClass
 *   * FalseClass
 */
Bully.is_immediate = function(obj) {
  return typeof obj === 'number' ||
                obj === null     ||
                obj === true     ||
                obj === false;
};

Bully.check_method_args = function(min, max, args) {
  var msg = 'wrong number of arguments (', n = args.length;

  if (min === max) {
    // 0 or more required arguments, no optionals
    if (n !== min) {
      msg += n + ' for ' + min + ')';
      Bully.raise(Bully.ArgumentError, msg);
    }
  }
  else if (max === -1) {
    // no limit on args
    if (n < min) {
      msg += n + ' for ' + min + ')';
      Bully.raise(Bully.ArgumentError, msg);
    }
  }
  else {
    // bounded number of args
    if (n < min) {
      msg += n + ' for ' + min + ')';
      Bully.raise(Bully.ArgumentError, msg);
    }
    else if (n > max) {
      msg += n + ' for ' + max + ')';
      Bully.raise(Bully.ArgumentError, msg);
    }
  }
};

Bully.dispatch_method = function(obj, name, args, block) {
  var id = Bully.intern(name), fn = Bully.find_method(Bully.class_of(obj), id);

  args = args || [];

  if (!fn) {
    args.unshift(id);
    return Bully.dispatch_method(obj, 'method_missing', args, block);
  }

  Bully.check_method_args(fn.min_args, fn.max_args, args);

  return fn.call(null, obj, args, block);
};

Bully.call_super = function(obj, name, args) {
  var fn = Bully.find_method(Bully.class_of(obj)._super, Bully.intern(name));

  // FIXME: check if method was found
  
  return fn.call(null, obj, args);
};

Bully.respond_to = function(obj, name) {
  return !!Bully.find_method(Bully.class_of(obj), Bully.intern(name));
};

Bully.init = function() {
  var metaclass;

  Bully.Object = Bully.defclass_boot('Object', null);
  Bully.Module = Bully.defclass_boot('Module', Bully.Object);
  Bully.Class  = Bully.defclass_boot('Class', Bully.Module);

  metaclass = Bully.make_metaclass(Bully.Object, Bully.Class);
  metaclass = Bully.make_metaclass(Bully.Module, metaclass);
  Bully.make_metaclass(Bully.Class, metaclass);

  Bully.define_global_const('Object', Bully.Object);
  Bully.define_global_const('Module', Bully.Module);
  Bully.define_global_const('Class', Bully.Class);

  // Class
  Bully.define_method(Bully.Class, 'allocate', function(self, args) {
    return Bully.make_object();
  });

  Bully.define_method(Bully.Class, 'new', function(self, args) {
    var o = Bully.dispatch_method(self, 'allocate');
    o.klass = self;

    if (Bully.respond_to(o, 'initialize')) {
      Bully.dispatch_method(o, 'initialize', args);
    }

    return o;
  });

  Bully.define_method(Bully.Class, 'name', function(self, args) {
    return Bully.str_new(Bully.ivar_get(self, '__classpath__'));
  });

  // FIXME: properly alias these methods
  Bully.define_method(Bully.Class, 'to_s', Bully.Class.m_tbl[Bully.intern('name')]);
  Bully.define_method(Bully.Class, 'inspect', Bully.Class.m_tbl[Bully.intern('name')]);

  Bully.define_method(Bully.Class, 'instance_methods', function(self, args) {
    var methods       = [],
        klass         = self,
        include_super = args.length > 0 ?args[0] : true, id;

    do {
      for (id in klass.m_tbl) {
        methods.push(Bully.str_new(Bully.id2str(id)));
      }

      klass = klass._super;
    } while (klass && include_super);

    return Bully.array_new(methods);
  }, 0, 1);

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

  Bully.define_method(Bully.Kernel, 'respond_to?', function(self, args) {
    return Bully.respond_to(self, args[0]);
  });

  // FIXME: properly alias this method
  Bully.define_method(Bully.Kernel, 'inspect', Bully.Kernel.m_tbl[Bully.intern('to_s')]);

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

      klass = klass._super;
    }

    return false;
  });

  Bully.define_method(Bully.Kernel, 'object_id', function(self, args) {
    if      (typeof self === 'number') { return Bully.int2fix(self); }
    else if (self === false)           { return Bully.int2fix(0); }
    else if (self === true)            { return Bully.int2fix(2); }
    else if (self === null)            { return Bully.int2fix(4); }

    return Bully.int2fix(self.id);
  }, 0, 0);

  // FIXME: properly alias this method
  Bully.define_method(Bully.Kernel, 'hash', Bully.Kernel.m_tbl[Bully.intern('object_id')]);

  Bully.define_method(Bully.Kernel, 'method_missing', function(self, args) {
    Bully.raise(Bully.NoMethodError, Bully.id2str(args[0]));
  }, 1, -1);

  // Object
  Bully.include_module(Bully.Object, Bully.Kernel);

  // FalseClass
  Bully.FalseClass = Bully.define_class('FalseClass');
  Bully.define_method(Bully.FalseClass, 'to_s', function() {
    return Bully.str_new('false');
  });
  // FIXME: alias this properly
  Bully.define_method(Bully.FalseClass, 'inspect', Bully.FalseClass.m_tbl[Bully.intern('to_s')]);

  // TrueClass
  Bully.TrueClass = Bully.define_class('TrueClass');
  Bully.define_method(Bully.TrueClass, 'to_s', function() {
    return Bully.str_new('true');
  });
  // FIXME: alias this properly
  Bully.define_method(Bully.TrueClass, 'inspect', Bully.TrueClass.m_tbl[Bully.intern('to_s')]);

  // NilClass
  Bully.NilClass = Bully.define_class('NilClass');
  Bully.define_method(Bully.NilClass, 'to_i', function() {
    return 0;
  });
  Bully.define_method(Bully.NilClass, 'nil?', function() {
    return true;
  });
  Bully.define_method(Bully.NilClass, 'to_s', function() {
    return Bully.str_new('');
  });
  Bully.define_method(Bully.NilClass, 'inspect', function() {
    return Bully.str_new('nil');
  });

  // main (top level self)
  Bully.main = Bully.dispatch_method(Bully.Object, 'new', []);
  Bully.define_singleton_method(Bully.main, 'to_s', function() {
    return Bully.str_new('main');
  });

  Bully.init_symbol();
  Bully.init_string();
  Bully.init_fixnum();
  Bully.init_error();
  Bully.init_enumerable();
  Bully.init_array();
  Bully.init_hash();
  Bully.init_proc();
};
