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
  }, 0, 1);

  Bully.define_singleton_method(Bully.Exception, 'exception', function(self, args) {
    return Bully.dispatch_method(self, 'new', args);
  }, 0, 1);

  Bully.define_method(Bully.Exception, 'message', function(self, args) {
    return Bully.ivar_get(self, '@message');
  });

  Bully.define_method(Bully.Exception, 'to_s', function(self, args) {
    var name = Bully.dispatch_method(Bully.dispatch_method(self, 'class'), 'name'),
        message = Bully.dispatch_method(self, 'message');

    return Bully.str_new(name.data + ': ' + message.data);
  });

  Bully.define_method(Bully.Exception, 'inspect', function(self, args) {
    var name = Bully.dispatch_method(Bully.dispatch_method(self, 'class'), 'name');
    return Bully.str_new('#<' + name.data + ': ' + Bully.dispatch_method(self, 'message').data + '>');
  });

  Bully.StandardError = Bully.define_class('StandardError', Bully.Exception);
  Bully.ArgumentError = Bully.define_class('ArgumentError', Bully.StandardError);
  Bully.RuntimeError  = Bully.define_class('RuntimeError', Bully.StandardError);
  Bully.NameError     = Bully.define_class('NameError', Bully.StandardError);
  Bully.TypeError     = Bully.define_class('TypeError', Bully.StandardError);
  Bully.NoMethodError = Bully.define_class('NoMethodError', Bully.NameError);
};
