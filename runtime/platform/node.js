var sys = require('sys');

Bully.platform = {
  puts: function(str) {
    sys.puts(str);
  }
};
