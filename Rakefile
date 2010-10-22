
task :test => 'build:preprocess' do
  files = FileList['test/**/*.bully']
  sh "./bin/bully #{files.join(' ')}"
end

task :lint do
  files = ENV['FILES'] ? ENV['FILES'].split(/\s+/) : FileList['src/**/*.js'] - ['src/parser.js']
  sh "node vendor/nodelint/nodelint #{files.join(' ')} --config config/lint.js"
end

namespace :build do
  desc 'Generate the parser'
  task :parser do
    sh "node bin/build_parser.js"
  end

  desc 'Preprocess javascript files'
  task :preprocess do
    sh "clang -x c -E -P -undef -Wundef -nostdinc -Wtrigraphs -fdollars-in-identifiers -C src/bully.js.pre >src/bully.js"
  end
end

desc 'Build the project'
task :build => ['build:parser', 'build:preprocess']

task :default => :test

