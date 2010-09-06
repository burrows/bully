
Bully.init_number = function() {
  Bully.Number = Bully.define_class('Number');

  // FIXME: undefine new method for Number

  Bully.define_method(Bully.Number, 'to_s', function(self, args) {
    return Bully.str_new(self.toString());
  });

  // FIXME: properly alias this method
  Bully.define_method(Bully.Number, 'inspect', Bully.Number.m_tbl.to_s);
};

