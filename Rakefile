
task :test do
  files = FileList['test/**/*.js']
  sh "node vendor/nodeunit/lib/testrunner.js #{files.join(' ')}"
end

task :default => :test

