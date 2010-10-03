
task :test => :lint do
  files = FileList['test/**/*.bully']
  sh "./bin/bully #{files.join(' ')}"
end

task :lint do
  files = ENV['FILES'] ? ENV['FILES'].split(/\s+/) : FileList['src/**/*.js'] - ['src/parser.js']
  sh "node vendor/nodelint/nodelint.js #{files.join(' ')} --config config/lint.js"
end

namespace :build do
  task :parser do
    sh "node bin/build_parser.js"
  end
end

task :default => :test

