'use strict';

var gulp = require('gulp');
var gutil = require('gulp-util');
var del = require('del');
var uglify = require('gulp-uglify');
var gulpif = require('gulp-if');
var exec = require('child_process').exec;
var buffer = require('vinyl-buffer');
var argv = require('yargs').argv;
var sourcemaps = require('gulp-sourcemaps');

// sass
var sass = require('gulp-sass');
var postcss = require('gulp-postcss');
var autoprefixer = require('autoprefixer');

// js
var browserify = require('browserify');
var source = require('vinyl-source-stream');
var babelify = require('babelify');
var nodemon = require('gulp-nodemon');

// production flag
var production = !argv.dev;

var syncbrowser = argv.browsersync;

// determine if we're doing a build
// and if so, bypass the livereload
var build = argv._.length ? argv._[0] === 'build' : false;
var watch = argv._.length ? argv._[0] === 'watch' : true;

gutil.log(gutil.colors.bgGreen('[Gulp flags]', 'production:', production, '| build:', build, '| watch:', watch, "| syncbrowser:", syncbrowser));

if (watch) {
  var watchify = require('watchify');
}

if (syncbrowser) {
  var browserSync = require('browser-sync').create();
}

var reloadbrowsersync = function() {
  if (syncbrowser) {
    browserSync.reload();
  }
}

// ----------------------------
// Error notification methods
// ----------------------------
var handleError = function(task) {
  return function(err) {
    gutil.log(gutil.colors.bgRed(task + ' error:'), gutil.colors.red(err));
    if (watch) this.emit('end');
  };
};

// --------------------------
// CUSTOM TASK METHODS
// --------------------------
var tasks = {
  // --------------------------
  // Delete build folder
  // --------------------------
  clean: function() {
    del.sync(['public']);

    return gulp.src('.gitignore')
      .pipe(gulp.dest('public/')
    );
  },
  // --------------------------
  // CSS compilation (LibSass + Autoprefixer)
  // --------------------------
  sass: function() {
    return gulp.src('src/assets/scss/[^_]*.scss')
      // sourcemaps + sass + error handling
      .pipe(gulpif(!production, sourcemaps.init()))
      .pipe(sass({
        errLogToConsole: true,
        sourceComments: !production,
        outputStyle: production ? 'compressed' : 'nested'
      }))
      .on('error', function(err) {
        sass.logError.bind(this, err)();
      })
      // generate .maps
      .pipe(gulpif(!production, sourcemaps.write({
        'includeContent': false,
        'sourceRoot': '.'
      })))
      // autoprefixer
      .pipe(gulpif(!production, sourcemaps.init({
        'loadMaps': true
      })))
      .pipe(postcss([autoprefixer({browsers: ['last 2 versions']})]))
      // we don't serve the source files
      // so include scss content inside the sourcemaps
      .pipe(sourcemaps.write({
        'includeContent': true
      }))
      // write sourcemaps to a specific directory
      // give it a file and save
      .pipe(gulp.dest('public/css'));
  },
  // --------------------------
  // Browserify bundles (Babelify + Watchify)
  // --------------------------
  babelify: function() {
    // Create a separate vendor bundler that will only run when starting gulp
    var vendorBundler = browserify({
      debug: !production // Sourcemapping
    })
    .require('react');

    var bundler = browserify({
      debug: !production, // Sourcemapping
      cache: {},
      packageCache: {},
      fullPaths: watch
    })
    .require(require.resolve('./src/app/app.jsx'), { entry: true })
    .transform('babelify')
    .external('react');

    if (watch) {
      bundler = watchify(bundler, {poll: true});
    }

    var rebundle = function() {
      var result = bundler.bundle()
        .on('error', handleError('Browserify'))
        .pipe(source('app.js'))
        .pipe(buffer())
        .pipe(gulpif(production, uglify()))
        .pipe(gulpif(!production, sourcemaps.init({loadMaps: true})))
        .pipe(gulpif(!production, sourcemaps.write('./')))
        .pipe(gulp.dest('public/js/'));

      if(syncbrowser) {
        return result.pipe(browserSync.reload({stream:true, once: true}));
      }

      return result;
    };

    if (watch) {
      bundler.on('update', rebundle);
      bundler.on('log', function (msg) {
        gutil.log('Babelify rebundle:', msg);
      });
    }

    vendorBundler.bundle()
      .pipe(source('vendors.js'))
      .pipe(buffer())
      .pipe(gulpif(production, uglify()))
      .pipe(gulp.dest('public/js/'));

    return rebundle();
  },
  // --------------------------
  // Node server (Nodemon + BrowserSync)
  // --------------------------
  serve: function(cb) {
    var started = false;

    return nodemon({
      verbose: true,
      legacyWatch: true,
      script: 'src/server/index.js',
      watch: ['src/server', 'src/templates'],
      execMap: {
          'js': 'babel-node'
      },
      ext: 'js html',
      stdout: false,
      env: {
        'NODE_ENV': 'development',
        'PORT': syncbrowser ? 8878 : 8877
      }
    }).on('start', function () {
      gutil.log(gutil.colors.bgGreen('Nodemon ' + (started ? 're' : 'first ') + 'start...'));
      if (!started) {
        started = true;
        if (syncbrowser) {
          browserSync.init(null, {
            port: 8877,
            proxy: {
              target: 'localhost:8878'
            },
            open: false
          });
        }
        cb();
      }
    }).on('readable', function(data) {
        // this is the best hack I have found so far to reload browsers once the
        // server is actually running after a restart, not just starting up
        this.stdout.on('data', function(chunk) {
            if (/up and running on/.test(chunk)) {
                reloadbrowsersync();
            }
            process.stdout.write(chunk);
        });
        this.stderr.pipe(process.stderr);
    });
  }
};

gulp.task('reload-sass', ['sass'], function(){
  reloadbrowsersync();
});

// --------------------------
// CUSTOMS TASKS
// --------------------------
gulp.task('clean', tasks.clean);
gulp.task('sass', tasks.sass);
gulp.task('babelify', tasks.babelify);
gulp.task('serve', ['build'], tasks.serve);
gulp.task('start', ['clean', 'serve']);

// build task
gulp.task('build', [
  'sass',
  'babelify'
]);


// --------------------------
// DEV/WATCH TASK
// --------------------------
gulp.task('watch', ['start'], function() {
  gulp.watch(['src/assets/scss/**/*.scss'], ['reload-sass']);
  gutil.log(gutil.colors.bgGreen('Watching for changes...'));
});

gulp.task('default', ['start']);
