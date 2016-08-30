    // general stuff
var gulp = require("gulp"),                       // gulp
    fs = require("fs"),                           // the file system
    notify = require("gulp-notify"),              // notifications
    plumber = require("gulp-plumber"),            // prevent pipe breaking
    runSequence = require("run-sequence"),        // allow tasks to be ran in sequence
    json = require("json-file"),                  // read/write JSON files
    prompt = require("gulp-prompt")               // allow user input
    argv = require("yargs").argv,                 // --flags
    del = require("del"),                         // delete files & folders
    newer = require("gulp-newer"),                // checks if files are newer
    merge = require("merge-stream"),              // merge streams
    gulpif = require("gulp-if"),                  // if statements in pipes
    watch = require("gulp-watch"),                // watch for file changes
    sourcemaps = require("gulp-sourcemaps"),      // sourcemaps
    concat = require("gulp-concat"),              // concatenater
    fileinclude = require("gulp-file-include"),   // file includer, variable replacer

    // media stuff
    imagemin = require("gulp-imagemin"),          // image compressor
    pngquant = require("imagemin-pngquant"),      // image compressor for PNGs

    // JS stuff
    jshint = require("gulp-jshint"),              // linter
    uglify = require("gulp-uglify"),              // concatenater
    babel = require("gulp-babel"),

    // CSS stuff
    sass = require("gulp-sass"),                  // SCSS compiler
    postcss = require("gulp-postcss"),            // postcss
    autoprefixer = require("gulp-autoprefixer"),  // autoprefix CSS
    flexibility = require("postcss-flexibility"), // flexibility

    // FTP stuff
    ftp = require("vinyl-ftp"),                   // FTP client

    ftpHost = "",                                 // FTP hostname (leave blank)
    ftpUser = "",                                 // FTP username (leave blank)
    ftpPass = "",                                 // FTP password (leave blank)
    ftpPath = "",                                 // FTP path (leave blank)

    // browser-sync stuff
    browserSync = require("browser-sync"),        // browser-sync

    bsProxy = "",                                 // browser-sync proxy (leave blank)
    bsPort = "",                                  // browser-sync port (leave blank)
    bsOpen = "",                                  // browser-sync open (leave blank)
    bsNotify = "",                                // browser-sync notify (leave blank)

    // read data from package.json
    name = json.read("./package.json").get("name"),
    description = json.read("./package.json").get("description"),
    version = json.read("./package.json").get("version"),
    repository = json.read("./package.json").get("repository"),
    license = json.read("./package.json").get("license"),

    // set up environment paths
    src = "./src",   // source directory
    dev = "./dev",   // development directory
    dist = "./dist", // production directory

    ranTasks = []; // store which tasks where ran

// Error handling
var onError = function(err) {
    notify.onError({
        title:    "Gulp",
        subtitle: "Error!",
        message:  "<%= error.message %>",
        sound:    "Beep"
    })(err);

    this.emit("end");
};

// media task, compresses images & copies media
gulp.task("media", function () {
    "use strict";

    // development media directory
    var mediaDirectory = dev + "/assets/media";
    var screenshotDirectory = dev;

    // production media directory (if --dist is passed)
    if (argv.dist) {
        mediaDirectory = dist + "/assets/media";
        screenshotDirectory = dist;
    }

    // clean directory if --dist is passed
    if (argv.dist) {
        del(mediaDirectory + "/**/*");
        del(screenshotDirectory + "/screenshot.png");
    }

    // compress images, copy media
    var media = gulp.src(src + "/assets/media/**/*")
        // check if source is newer than destination
        .pipe(gulpif(!argv.dist, newer(mediaDirectory)))
        // compress images
        .pipe(imagemin({
            progressive: true,
            svgoPlugins: [{removeViewBox: false}],
            use: [pngquant()]
        }))
        // output to the compiled directory
        .pipe(gulp.dest(mediaDirectory));

    // compress screenshot
    var screenshot = gulp.src(src + "/screenshot.png")
        // check if source is newer than destination
        .pipe(gulpif(!argv.dist, newer(screenshotDirectory)))
        // compress screenshot
        .pipe(imagemin({
            progressive: true,
            svgoPlugins: [{removeViewBox: false}],
            use: [pngquant()]
        }))
        // output to the compiled directory
        .pipe(gulp.dest(screenshotDirectory));

    // merge both steams back in to one
    return merge(media, screenshot)
        // reload the files
        .pipe(browserSync.reload({stream: true}))
        // notify that the task is complete, if not part of default or watch
        .pipe(gulpif(gulp.seq.indexOf("media") > gulp.seq.indexOf("default"), notify({title: "Success!", message: "Media task complete!", onLast: true})))
        // push the task to the ranTasks array
        .on("data", function() {
            if (ranTasks.indexOf("media") < 0) ranTasks.push("media");
        });
});

// scripts task, concatenates & lints JS
gulp.task("scripts", function () {
    "use strict";

    // development JS directory
    var jsDirectory = dev + "/assets/scripts";

    // production JS directory (if --dist is passed)
    if (argv.dist) jsDirectory = dist + "/assets/scripts";

    // clean directory if --dist is passed
    if (argv.dist) del(jsDirectory + "/**/*");

    // lint scripts
    var linted = gulp.src([src + "/assets/scripts/*.js", "!" + src + "/assets/scripts/vendor.*.js"])
        // check if source is newer than destination
        .pipe(gulpif(!argv.dist, newer(jsDirectory + "/all.js")))
        // lint all non-vendor scripts
        .pipe(jshint())
        // print lint errors
        .pipe(jshint.reporter("default"));

    // concatenate vendor scripts (go in footer)
    var critical = gulp.src([src + "/assets/scripts/vendor/jquery.min.js", src + "/assets/scripts/vendor/bootstrap.min.js", src + "/assets/scripts/vendor/*.js"])
        // check if source is newer than destination
        .pipe(gulpif(!argv.dist, newer(jsDirectory + "/vendor.js")))
        // initialize sourcemap
        .pipe(sourcemaps.init())
        // concatenate to all.js
        .pipe(concat("vendor.js"))
        // uglify (if --dist is passed)
        .pipe(gulpif(argv.dist, uglify()))
        // write the sourcemap (if --dist isn't passed)
        .pipe(gulpif(!argv.dist, sourcemaps.write()))
        // output to the compiled directory
        .pipe(gulp.dest(jsDirectory));

    // concatenate critical scripts
    var critical = gulp.src([src + "/assets/scripts/critical/loadCSS.js", src + "/assets/scripts/critical/loadCSS.cssrelpreload.js"])
        // check if source is newer than destination
        .pipe(gulpif(!argv.dist, newer(jsDirectory + "/critical.js")))
        // initialize sourcemap
        .pipe(sourcemaps.init())
        // concatenate to all.js
        .pipe(concat("critical.js"))
        // transform code from babel
        .pipe(babel({
            presets: ['es2015']
        }))
        // uglify (if --dist is passed)
        .pipe(gulpif(argv.dist, uglify()))
        // write the sourcemap (if --dist isn't passed)
        .pipe(gulpif(!argv.dist, sourcemaps.write()))
        // output to the compiled directory
        .pipe(gulp.dest(jsDirectory));

    // concatenate modern scripts
    var modern = gulp.src([src + "/assets/scripts/vendor.*.js", src + "/assets/scripts/jquery.*.js", src + "/assets/scripts/*.js"])
        // check if source is newer than destination
        .pipe(gulpif(!argv.dist, newer(jsDirectory + "/modern.js")))
        // initialize sourcemap
        .pipe(sourcemaps.init())
        // concatenate to all.js
        .pipe(concat("modern.js"))
        // transform code from babel
        .pipe(babel({
            presets: ['es2015']
        }))
        // uglify (if --dist is passed)
        .pipe(gulpif(argv.dist, uglify()))
        // write the sourcemap (if --dist isn't passed)
        .pipe(gulpif(!argv.dist, sourcemaps.write()))
        // output to the compiled directory
        .pipe(gulp.dest(jsDirectory));

    // concatenate legacy scripts
    var legacy = gulp.src([src + "/assets/scripts/legacy/**/*"])
        // check if source is newer than destination
        .pipe(gulpif(!argv.dist, newer(jsDirectory + "/legacy.js")))
        // initialize sourcemap
        .pipe(sourcemaps.init())
        // concatenate to all.js
        .pipe(concat("legacy.js"))
        // transform code from babel
        .pipe(babel({
            presets: ['es2015']
        }))
        // uglify (if --dist is passed)
        .pipe(gulpif(argv.dist, uglify()))
        // write the sourcemap (if --dist isn't passed)
        .pipe(gulpif(!argv.dist, sourcemaps.write()))
        // output to the compiled directory
        .pipe(gulp.dest(jsDirectory));

    // merge all four steams back in to one
    return merge(linted, critical, modern, legacy)
        // reload the files
        .pipe(browserSync.reload({stream: true}))
        // notify that the task is complete, if not part of default or watch
        .pipe(gulpif(gulp.seq.indexOf("scripts") > gulp.seq.indexOf("default"), notify({title: "Success!", message: "Scripts task complete!", onLast: true})))
        // push the task to the ranTasks array
        .on("data", function() {
            if (ranTasks.indexOf("scripts") < 0) ranTasks.push("scripts");
        });
});

// styles task, compiles & prefixes SCSS
gulp.task("styles", function () {
    "use strict";

    // development CSS directory
    var cssDirectory = dev + "/assets/styles";

    // production CSS directory (if --dist is passed)
    if (argv.dist) cssDirectory = dist + "/assets/styles";

    // clean directory if --dist is passed
    if (argv.dist) del(cssDirectory + "/**/*");

    // compile all SCSS in the root styles directory
    return gulp.src(src + "/assets/styles/*.scss")
        // prevent breaking on error
        .pipe(plumber({errorHandler: onError}))
        // check if source is newer than destination
        .pipe(gulpif(!argv.dist, newer({dest: cssDirectory + "/modern.css", extra: [src + "/assets/styles/**/*.scss"]})))
        // initialize sourcemap
        .pipe(sourcemaps.init())
        // compile SCSS (compress if --dist is passed)
        .pipe(gulpif(argv.dist, sass({outputStyle: "compressed"}), sass()))
        // prefix CSS
        .pipe(autoprefixer("last 2 version", "ie 8", "ie 9"))
        // insert -js-display: flex; for flexbility
        .pipe(postcss([flexibility()]))
        // write the sourcemap (if --dist isn't passed)
        .pipe(gulpif(!argv.dist, sourcemaps.write()))
        // output to the compiled directory
        .pipe(gulp.dest(cssDirectory))
        // reload the files
        .pipe(browserSync.reload({stream: true}))
        // notify that the task is complete, if not part of default or watch
        .pipe(gulpif(gulp.seq.indexOf("styles") > gulp.seq.indexOf("default"), notify({title: "Success!", message: "Styles task complete!", onLast: true})))
        // push the task to the ranTasks array
        .on("data", function() {
            if (ranTasks.indexOf("styles") < 0) ranTasks.push("styles");
        });
});

// styles task, compiles & prefixes SCSS
gulp.task("html", function () {
    "use strict";

    // development HTML directory
    var htmlDirectory = dev;

    // production HTML directory (if --dist is passed)
    if (argv.dist) htmlDirectory = dist;

    // clean directory if --dist is passed
    if (argv.dist) del([htmlDirectory + "/**/*", "!" + htmlDirectory + "{/assets,/assets/**}"]);

    // import HTML files and replace their variables
    return gulp.src([src + "/**/*", "!" + src + "/screenshot.png", "!" + src + "{/assets,/assets/**}"])
        // check if source is newer than destination
        .pipe(gulpif(!argv.dist, newer({dest: htmlDirectory, extra: [src + "{/partials,/partials/**}"]})))
        // insert variables
        .pipe(fileinclude({
            prefix: "@@",
            basepath: "@file",
            context: {
                name: name,
                description: description,
                version: version,
                repository: repository,
                license: license,
            }
        }))
        // output to the compiled directory
        .pipe(gulp.dest(htmlDirectory))
        // reload the files
        .pipe(browserSync.reload({stream: true}))
        // notify that the task is complete, if not part of default or watch
        .pipe(gulpif(gulp.seq.indexOf("html") > gulp.seq.indexOf("default"), notify({title: "Success!", message: "HTML task complete!", onLast: true})))
        // push the task to the ranTasks array
        .on("data", function() {
            if (ranTasks.indexOf("html") < 0) ranTasks.push("html");
        });
});

gulp.task("config", function (cb) {
    "use strict";

    fs.stat("./config.json", function (err, stats) {
        if (err != null) {
            fs.writeFile("./config.json", "{\"ftp\": {\"dev\": {\"host\": \"\",\"user\": \"\",\"pass\": \"\",\"path\": \"\"},\"dist\": {\"host\": \"\",\"user\": \"\",\"pass\": \"\",\"path\": \"\"}},\"browsersync\": {\"proxy\": \"\",\"port\": \"\",\"open\": \"\",\"notify\": \"\"}}", function (err) {
                configureFTP(function() {
                    configureBrowsersync();
                });
            });
        } else {
            configureFTP(function() {
                configureBrowsersync();
            });
        }
    });

    function configureFTP(cb) {
        // read FTP settingss from config.json
        if (!argv.dist) {
            ftpHost = json.read("./config.json").get("ftp.dev.host"),
            ftpUser = json.read("./config.json").get("ftp.dev.user"),
            ftpPass = json.read("./config.json").get("ftp.dev.pass"),
            ftpPath = json.read("./config.json").get("ftp.dev.path");
        } else {
            ftpHost = json.read("./config.json").get("ftp.dist.host"),
            ftpUser = json.read("./config.json").get("ftp.dist.user"),
            ftpPass = json.read("./config.json").get("ftp.dist.pass"),
            ftpPath = json.read("./config.json").get("ftp.dist.path");
        }

        if (argv.all || (gulp.seq.indexOf("config") < gulp.seq.indexOf("ftp") || argv.ftp) && (argv.config || ftpHost === "" || ftpUser === "" || ftpPass === "" || ftpPath === "")) {
            // reconfigure settings in config.json if a field is empty or if --config is passed
            gulp.src("./config.json")
                .pipe(prompt.prompt([{
                    // prompt for the host
                    type: "input",
                    name: "host",
                    message: "FTP hostname:",
                    default: ftpHost,
                },
                {
                    // prompt for the user
                    type: "input",
                    name: "user",
                    message: "FTP username:",
                    default: ftpUser,
                },
                {
                    // prompt for the host
                    type: "password",
                    name: "pass",
                    message: "FTP password:",
                    default: ftpPass,
                },
                {
                    // prompt for the path
                    type: "input",
                    name: "path",
                    message: "FTP remote path:",
                    default: ftpPath,
                }], function(res) {
                    // open the browsersync.json
                    var file = json.read("./config.json");

                    // update the ftp settings in config.json
                    if (!argv.dist) {
                        file.set("ftp.dev.host", res.host);
                        file.set("ftp.dev.user", res.user);
                        file.set("ftp.dev.pass", res.pass);
                        file.set("ftp.dev.path", res.path);
                    } else {
                        file.set("ftp.dist.host", res.host);
                        file.set("ftp.dist.user", res.user);
                        file.set("ftp.dist.pass", res.pass);
                        file.set("ftp.dist.path", res.path);
                    }

                    // write the updated file contents
                    file.writeSync();

                    // read browsersync settings from browsersync.json
                    ftpHost = res.host,
                    ftpUser = res.user,
                    ftpPass = res.pass,
                    ftpPath = res.path;

                    configureBrowsersync();
                }));
        } else {
            configureBrowsersync();
        }
    }

    function configureBrowsersync() {
        // read browsersync settings from config.json
        bsProxy = json.read("./config.json").get("browsersync.proxy"),
        bsPort = json.read("./config.json").get("browsersync.port"),
        bsOpen = json.read("./config.json").get("browsersync.open"),
        bsNotify = json.read("./config.json").get("browsersync.notify");

        if (argv.all || (gulp.seq.indexOf("config") < gulp.seq.indexOf("sync") || argv.sync) && (argv.config || bsProxy === "" || bsPort === "" || bsOpen === "" || bsNotify === "")) {
            // reconfigure settings in config.json if a field is empty or if --config is passed
            gulp.src("./config.json")
                .pipe(prompt.prompt([{
                    // prompt for the proxy
                    type: "input",
                    name: "proxy",
                    message: "Browsersync proxy:",
                    default: bsProxy,
                },
                {
                    // prompt for the port
                    type: "input",
                    name: "port",
                    message: "Browsersync port:",
                    default: bsPort,
                },
                {
                    // prompt for how to open
                    type: "input",
                    name: "open",
                    message: "Browsersync open:",
                    default: bsOpen,
                },
                {
                    // prompt for whether to notify
                    type: "input",
                    name: "notify",
                    message: "Browsersync notify:",
                    default: bsNotify,
                }], function(res) {
                    // open the browsersync.json
                    var file = json.read("./config.json");

                    // update the browsersync settings in config.json
                    file.set("browsersync.proxy", res.proxy);
                    file.set("browsersync.port", res.port);
                    file.set("browsersync.open", res.open);
                    file.set("browsersync.notify", res.notify);

                    // write the updated file contents
                    file.writeSync();

                    // read browsersync settings from browsersync.json
                    bsProxy = res.proxy,
                    bsPort = res.port,
                    bsOpen = res.open,
                    bsNotify = res.notify;

                    cb();
                }));
        } else {
            cb();
        }
    }
});

// upload to FTP environment, depends on config
gulp.task("ftp", ["config"], function(cb) {
    // development FTP directory
    var ftpDirectory = dev;

    // production FTP directory (if --dist is passed)
    if (argv.dist) ftpDirectory = dist;

    // create the FTP connection
    var conn = ftp.create({
        host: ftpHost,
        user: ftpUser,
        pass: ftpPass,
        path: ftpPath,
    })

    // upload the changed files
    return gulp.src(ftpDirectory + "/**/*")
        // check if files are newer
        .pipe(gulpif(!argv.dist, conn.newer(ftpPath)))
        // upload changed files
        .pipe(conn.dest(ftpPath))
        // reload the files
        .pipe(browserSync.reload({stream: true}))
        // notify that the task is complete
        .pipe(notify({title: "Success!", message: "FTP task complete!", onLast: true}));

    // return
    cb();;
});

// set up a browserSync server, depends on config
gulp.task("sync", ["config"], function(cb) {
    browserSync({
        proxy: bsProxy,
        port: bsPort,
        open: bsOpen,
        notify: bsNotify,
    });
});

// default task, runs through everything but dist
gulp.task("default", ["media", "scripts", "styles", "html"], function () {
    "use strict";

    // notify that the task is complete
    gulp.src("gulpfile.js")
        .pipe(gulpif(ranTasks.length, notify({title: "Success!", message: "Task(s) complete! [" + ranTasks.join(", ") + "]", onLast: true})));

    // trigger FTP task if FTP flag is passed
    if (argv.ftp) runSequence("ftp");

    // reset the ranTasks array
    ranTasks.length = 0;
});

// watch task, runs through everything but dist, triggers when a file is saved
gulp.task("watch", function () {
    "use strict";

    // set up a browserSync server, if --sync is passed
    if (argv.sync) runSequence("sync");

    // watch for any changes
    watch("./src/**/*", function () {
        // run through all tasks, then ftp, if --ftp is passed
        runSequence("default");
    });
});
