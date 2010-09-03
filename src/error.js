

// FIXME: add support for a message attribute

Bully.Exception    = Bully.define_class('Exception');
Bully.RuntimeError = Bully.define_class('RuntimeError', Bully.Exception);

Bully.raise = function(exception) {
  if (Bully.dispatch_method(exception, 'is_a?', [Bully.Class])) {
    exception = Bully.dispatch_method(exception, 'new', []);
  }

  throw exception;
};

