exports.klass = function(super) {
  var k = {
    methods: {},

    classMethod: function(name, f) {
      this[name] = f;
      this[name].base = this.super ? this.super[name] : null;
    },

    method: function(name, f) {
      this.methods[name] = f;
      this.methods[name].base = this.super ? this.super.methods[name] : null;
    },

    create: function() {
      var o = Object.create(this.methods);

      if (o.initialize) {
        o.initialize.apply(o, Array.prototype.slice.apply(arguments));
      }

      o.klass = this;

      return o;
    }
  }, prop;

  if (super) {
    /* copy class methods */
    for (prop in super) {
      if (!k.hasOwnProperty(prop)) {
        k[prop] = super[prop];
      }
    }

    /* copy instance methods */
    for (prop in super.methods) {
      k.methods[prop] = super.methods[prop];
    }

    k.super = super;
  }

  return k;
};

