Bully.raise = function(exception, message) {
  var args = message ? [Bully.str_new(message)] : [];
  if (Bully.dispatch_method(exception, 'is_a?', [Bully.Class])) {
    exception = Bully.dispatch_method(exception, 'new', args);
  }

  throw exception;
};

Bully.init_error = function() {
  Bully.Exception = Bully.define_class('Exception');

  Bully.define_method(Bully.Exception, 'initialize', function(self, args) {
    Bully.ivar_set(self, '@message', args[0] ||
      Bully.dispatch_method(Bully.dispatch_method(self, 'class'), 'name'));
  });

  Bully.define_method(Bully.Exception, 'message', function(self, args) {
    return Bully.ivar_get(self, '@message');
  });

  Bully.define_method(Bully.Exception, 'to_s', function(self, args) {
    return Bully.dispatch_method(self, 'message');
  });

  Bully.define_method(Bully.Exception, 'inspect', function(self, args) {
    var name = Bully.dispatch_method(Bully.dispatch_method(self, 'class'), 'name');
    return Bully.str_new('#<' + name.data + ': ' + Bully.dispatch_method(self, 'message').data + '>');
  });

  Bully.RuntimeError  = Bully.define_class('RuntimeError', Bully.Exception);
  Bully.ArgumentError = Bully.define_class('ArgumentError', Bully.Exception);
  Bully.NoMethodError = Bully.define_class('NoMethodError', Bully.Exception);
};
