Bully.str2id_tbl = {};
Bully.id2str_tbl = {};

Bully.next_id = 10;

Bully.intern = function(js_str) {
  var id;

  if (Bully.str2id_tbl.hasOwnProperty(js_str)) {
    id = Bully.str2id_tbl[js_str];
  }
  else {
    id = Bully.next_id;
    Bully.next_id += 4;
    Bully.str2id_tbl[js_str] = id;
    Bully.id2str_tbl[id] = js_str;
  }

  return id;
};

Bully.id2str = function(id) {
  return Bully.id2str_tbl[id];
};

Bully.sym_equals = function(id, args) {
  return id === args[0];
};

Bully.init_symbol = function() {
  Bully.Symbol = Bully.define_class('Symbol');

  Bully.define_method(Bully.Symbol, 'inspect', function(self, args) {
    return Bully.str_new(':' + Bully.id2str(self));
  }, 0, 0);

  Bully.define_method(Bully.Symbol, '==', Bully.sym_equals, 1, 1);
};

