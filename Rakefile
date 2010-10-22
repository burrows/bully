$cpp      = 'clang'
$cpp_opts = '-x c -E -P -undef -Wundef -nostdinc -Wtrigraphs -fdollars-in-identifiers -C' 

desc 'Run all tests'
task :test => ['lint', 'build:preprocess'] do
  files = FileList['test/**/*.bully']
  sh "./bin/bully #{files.join(' ')}"
end

namespace :lint do
  task :preprocess do
    FileUtils.rm_rf('./tmp')
    FileUtils.mkdir('./tmp')
    files = FileList['src/**/*.js.pre'] - ['src/bully.js.pre']
    files.each do |file|
      out = File.basename(file).sub(/\.pre$/, '')
      sh "#$cpp #$cpp_opts -imacros ./src/bully.js.pre #{file} > ./tmp/#{out}"
    end
  end

  task :run => :preprocess do
    files = FileList['tmp/*.js'] + ['src/grammar.js']
    r = sh "node vendor/nodelint/nodelint #{files.join(' ')} --config config/lint.js"
    FileUtils.rm_rf('./tmp')
    r
  end
end

desc 'Run JSLint on the JavaScript source'
task :lint => 'lint:run'

namespace :build do
  desc 'Generate the parser'
  task :parser do
    sh "node bin/build_parser.js"
  end

  desc 'Preprocess javascript files'
  task :preprocess do
    sh "#$cpp #$cpp_opts src/bully.js.pre >src/bully.js"
  end
end

desc 'Build the project'
task :build => ['build:parser', 'build:preprocess']

task :default => :test

