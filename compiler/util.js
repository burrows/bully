exports.klass = function(data) {
  var k = {
    methods: {},

    create: function() {
      var o = Object.create(this.methods);

      if (o.initialize) {
        o.initialize.apply(o, Array.prototype.slice.apply(arguments));
      }

      o.klass = this;

      return o;
    }
  }, prop;

  if (data.super) {
    /* copy class methods */
    for (prop in data.super) {
      if (!k.hasOwnProperty(prop)) {
        k[prop] = data.super[prop];
      }
    }

    /* copy instance methods */
    for (prop in data.super.methods) {
      k.methods[prop] = data.super.methods[prop];
    }

    k.super = data.super;
  }

  if (data.classMethods) {
    for (prop in data.classMethods) {
      k[prop] = data.classMethods[prop];
      k[prop].base = k.super ? k.super[prop] : null;
    }
  }

  if (data.instanceMethods) {
    for (prop in data.instanceMethods) {
      k.methods[prop] = data.instanceMethods[prop];
      k.methods[prop].base = k.super ? k.super.methods[prop] : null;
    }
  }

  return k;
};

exports.fmt = function(str) {
  var args = Array.prototype.slice.call(arguments, 1), arg;

  return str.replace(/%@/g, function() {
    arg = args.shift();
    return typeof arg === 'string' ? arg : arg.toString();
  });
};

