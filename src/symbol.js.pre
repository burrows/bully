Bully.symbol_ids = {};
Bully.next_symbol_id = 11;

Bully.intern = function(js_str) {

  return js_str;
};

Bully.init_symbol = function() {
  Bully.Symbol = Bully.define_class('Symbol');

  Bully.define_method(Bully.Symbol, 'inspect', function(self, args) {
    return Bully.str_new(':' + self);
  }, 0, 0);

  Bully.define_method(Bully.Symbol, '==', function(self, args) {
    return self === args[0];
  }, 1, 1);

  Bully.define_method(Bully.Symbol, 'to_s', function(self) {
    return Bully.str_new(self);
  }, 0, 0);
};

