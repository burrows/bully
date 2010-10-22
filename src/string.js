
Bully.str_new = function(js_str) {
  var s = Bully.dispatch_method(Bully.String, 'new');
  s.data = js_str;
  return s;
};

Bully.str_cat = function(str, js_str) {
  str.data += js_str;
  return str;
};

Bully.str_hash = function(str) {
  var s = str.data, len = s.length, key = 0, i;

  for (i = 0; i < len; i += 1) {
    key += s.charCodeAt(i);
    key += (key << 10);
    key ^= (key >> 6);
  }

  key += (key << 3);
  key ^= (key >> 11);
  key += (key << 15);

  return key;
};

Bully.str_slice = function(str, args) {
  var s = str.data, i1 = args[0], i2 = args[1];

  return Bully.str_new(s.slice(i1, i1 + i2));
};

Bully.str_equals = function(str, args) {
  return str.data === args[0].data;
};

Bully.init_string = function() {
  Bully.String = Bully.define_class('String');

  Bully.define_singleton_method(Bully.String, 'allocate', function(self, args) {
    var o = Bully.make_object();
    o.data = "";
    return o;
  });

  Bully.define_method(Bully.String, 'to_s', function(self, args) {
    return self;
  }, 0, 0);

  Bully.define_method(Bully.String, 'inspect', function(self, args) {
    return Bully.str_new('"' + self.data + '"');
  }, 0, 0);

  Bully.define_method(Bully.String, '<<', function(self, args) {
    Bully.str_cat(self, Bully.dispatch_method(args[0], 'to_s').data);
    return self;
  }, 1, 1);

  Bully.define_method(Bully.String, 'to_sym', function(self, args) {
    return Bully.intern(self.data);
  }, 0, 0);

  // FIXME: properly alias this method
  Bully.define_method(Bully.String, '+', Bully.String.m_tbl[Bully.intern('<<')]);

  Bully.define_method(Bully.String, 'hash', Bully.str_hash, 0, 0);
  Bully.define_method(Bully.String, 'slice', Bully.str_slice, 2, 2);
  Bully.define_method(Bully.String, '==', Bully.str_equals, 1, 1);
};

