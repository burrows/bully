
Bully.str_new = function(js_str) {
  var s = Bully.dispatch_method(Bully.String, 'new');
  s.data = js_str;
  return s;
};

Bully.str_cat = function(str, js_str) {
  str.data += js_str;
  return str;
};

Bully.init_string = function() {
  Bully.String = Bully.define_class('String');

  Bully.define_singleton_method(Bully.String, 'new', function(self, args) {
    var s = Bully.call_super(self, arguments.callee.klass, 'new', args);
    s.data = '';
    return s;
  });

  Bully.define_method(Bully.String, 'to_s', function(self, args) {
    return self;
  });

  Bully.define_method(Bully.String, '<<', function(self, args) {
    Bully.str_cat(self, Bully.dispatch_method(args[0], 'to_s').data);
    return self;
  });
};

