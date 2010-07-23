
var util  = require('util');
    klass = util.klass,
    fmt   = util.fmt;

var Scope = exports.Scope = klass({
  instanceMethods: {
    initialize: function(parent) {
      this.parent = parent;
      this.vars   = {};
    },

    find: function(name) {
      if (this.check(name)) { return true; }
      this.vars[name] = true;;
      return false;
    },

    check: function(name) {
      if (this.vars.hasOwnProperty(name)) {
        return true;
      }
      else if (this.parent) {
        return this.parent.check(name);
      }
      else {
        return false;
      }
    },

    compile: function() {
      var names = [], name;

      for (name in this.vars) {
        names.push(name);
      }

      return names.length > 0 ? fmt('var %@;', names.join(', ')) : '';
    }
  }
});


