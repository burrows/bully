Bully.int2fix = function(js_int) {
  return (js_int << 1) | 1;
};

Bully.fix2int = function(fixnum) {
  return fixnum >> 1;
};

Bully.init_fixnum = function() {
  Bully.Fixnum = Bully.define_class('Fixnum');

  // FIXME: undefine new method for Fixnum

  Bully.define_method(Bully.Fixnum, 'to_s', function(self, args) {
    return Bully.str_new(Bully.fix2int(self).toString());
  });

  // FIXME: properly alias this method
  Bully.define_method(Bully.Fixnum, 'inspect', Bully.Fixnum.m_tbl[Bully.intern('to_s')]);
};

