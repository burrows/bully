
task :test do
  files = FileList['test/**/*.js']
  sh "node vendor/nodeunit/lib/testrunner.js #{files.join(' ')}"
end

namespace :build do
  task :parser do
    sh "node bin/build_parser.js"
  end
end

task :default => :test

