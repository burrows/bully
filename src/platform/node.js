var sys = require('sys');

Bully.platform = {
  puts: sys.puts,
  exit: process.exit
};
