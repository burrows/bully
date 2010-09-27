var sys = require('sys');

Bully.platform = {
  puts: sys.puts,
  print: sys.print,
  exit: process.exit
};
