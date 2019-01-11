var help = `===== BUILD BOATS ANIMATOR EXECUTABLES =====

Usage: node build <OPTIONS>

<OPTIONS>
--platforms, -p "win32"
* String
* Which platforms to output for. Possible values: "linux64,linux32,osx64,win32,win64"
* Default: "linux64,linux32,osx64,win32"

--extras, -e "exe"
* String
* Which packages to build in addition to binaries. Possible values:
  > "exe" - Create win32 setup file.
          - Requires installing Inno Setup 5 and to be running Windows to build.
* Default: ""

--noCompress, -n
* Boolean
* Enable to stop output directories from being added to ZIP/TAR archives. Useful for debugging.
* Default: false

--help, -h true
* Boolean
* Displays this help message.`;

var manifest = require('./package.json'),
    process  = require("process"),
    exec     = require('child_process').exec,
    fs       = require("fs.extra"),
    curDir   = require('path').dirname(require.main.filename),
    archiver = require('archiver'),
    NwBuilder = require("nw-builder"),

    // Command line arguments.
    cmdArgs  = require('command-line-args'),
    optionDefinitions = [
      { name: "platforms", alias: "p", type: String, defaultValue: "linux64,linux32,osx64,win32" },
      { name: "extras", alias: "e", type: String, defaultValue: ""},
      { name: "noCompress", alias: "n", type: Boolean, defaultValue: false},
      { name: "help", alias: "h", type: Boolean, defaultValue: false}
    ],
    cmdOptions = cmdArgs(optionDefinitions),
    extras = cmdOptions.extras,
    compress = (cmdOptions.noCompress ? false : true),

    options = {
      appName: "BoatsAnimator",
      files: "temp/**",
      version: "0.35.4",
      flavor: "normal",
      platforms: cmdOptions.platforms.split(","),
      buildDir: "bin/Boats-Animator",
      macIcns: "icons/icon.icns",
      winVersionString: {
        'CompanyName': "Boats Animator Developers",
        'FileDescription': 'Boats Animator',
        'ProductName': 'Boats Animator',
        'LegalCopyright': "© 2019 Charlie Lee",
      },
      winIco: "icons/icon.ico",
      buildType: function () {return this.appVersion;}
    };

    var nw = new NwBuilder(options);

if (cmdOptions.help) {
  console.log(help);
} else {
  createTemp();
}

// Move the files to be packaged to a temp directory.
function createTemp() {
  fs.mkdir("temp", function(err) {
    console.log(err ? err : "Create temp directory");

    fs.copy("package.json", "temp/package.json", function(err) {
      console.log(err ? err : "Copy package.json");

      fs.mkdir("temp/icons", function(err) {
        fs.copy("icons/icon.png", "temp/icons/icon.png", function (err) {
          console.log(err ? err : "Copy icon.png");
        });

        fs.copyRecursive("app", "temp/app", function(err) {
          console.log(err ? err : "Copy app directory");
          build();
        });
      });
    });
  });
}

// Use nw-builder to create the output
function build() {
  nw.build().then(function() {
    console.log("Finished exporting packages");
    fs.rmrf("temp", function(err) {
      console.log(err ? err : "Delete temp directory");

      console.log("Running platform specific additions...");
      linux();
      mac();
      windows();
    });
  }).catch(function(err) {
    console.log(err);
  })
}

// Linux specific changes.
function linux() {
  // Check whether output platforms contains linux32, linux64, both or neither.
  var linuxPlatforms = [];
  if (options.platforms.includes("linux32")) {
    linuxPlatforms.push("linux32");
  }
  if (options.platforms.includes("linux64")) {
    linuxPlatforms.push("linux64");
  }

  linuxPlatforms.forEach(function(platform) {
    // Rename the output directory
    renameOutputDir(platform)
    .then((outputDir) => {
      // Set Linux executable permissions
      fs.chmod(`${outputDir}/${options.appName}`, 0777, function(err) {
        console.log(err ? err : `  ${platform}: Set BoatsAnimator executable file permissions`);

        // Create .desktop file
        fs.writeFile(`${outputDir}/boats-animator.desktop`,
        `[Desktop Entry]
        Name=Boats Animator
        Version=${manifest.version}
        Comment=Create stop motion animations
        Exec=bash -c "cd $(dirname %k) && ./${options.appName}"
        Type=Application
        Terminal=false`, function(err) {
          console.log(err ? err : `  ${platform}: Create .desktop file`);

          // Set .desktop file permissions
          fs.chmod(`${outputDir}/boats-animator.desktop`, 0777, function(err) {
            console.log(err ? err : `  ${platform}: Set .desktop file permissions`);

            // Compress Linux dirs
            compressDir(outputDir, "tar.gz");
          });
        });
      });
    });
  });
}

// Mac OS specific changes.
function mac() {
  if (options.platforms.includes("osx64")) {
    // Rename the output directory
    renameOutputDir(platform)
    .then((outputDir) => {
      // Compress Mac dirs
      compressDir(`${outputDir}`, "zip");
    });
  }
}

// Win32 specific changes.
function windows() {
  if (options.platforms.includes("win32")) {
    // Rename the output directory
    renameOutputDir(platform)
    .then((outputDir) => {
      if (process.platform === "win32" && extras.includes("exe")) {
        // Create installer file using Inno Setup
        fs.open("C:/Program Files (x86)/Inno Setup 5", "r", function(err, fd) {
          if (err) {
            console.error("  win32: Please install Inno Setup 5 to create a win32 installer");
          } else {
            exec(`cd C:/Program Files (x86)/Inno Setup 5/ && ISCC.exe ${curDir}/win-install/setup.iss`, function(error, stdout, stderr) {
              if (error) {
                console.error(`Exec error: ${error}`);
              }
              if (stderr) {
                console.error(`Stderr: ${stderr}`);
              }
              console.log("  win32: Create setup executable");

              // Compress the Win32 dir after setup exe is made.
              compressDir(`${outputDir}`, "zip");
            });
          }
        });
      } else {
        // Compress the Win32 dir.
        compressDir(`${outputDir}`, "zip");
      }
    });
  }
}

/**
 * Rename the output directory for a platform to the
 * appname-version-platform format. 
 * @param {String} platform 
 */
function renameOutputDir(platform) {
  var newDirName = `${options.buildDir}/${manifest.name}-${manifest.version}-${platform}`;

  return new Promise(function(resolve, reject) {
    fs.rename(`${options.buildDir}/${platform}`, newDirName, function(err) {
      if (err) {
        console.error(err);
        reject("Error renaming directory")
      } else {
        console.log(`  ${platform}: Renamed output directory`);
        resolve(newDirName);
      }
    });
  }
}

/**
 * Create a compressed archive from a directory.
 * @param {String} dir    Location of directory to compress.
 * @param {String} format Format to compress to (eg ZIP or TAR)
 */
function compressDir(dir, format) {
  if (compress) {
    var output = fs.createWriteStream(`${dir}.${format}`),
        archive;

    // Work with tar.gz
    if (format === "tar.gz") {
      archive = archiver("tar", { gzip: true });
    } else {
      archive = archiver(format);
    }

    output.on("close", function() {
      console.log(`  archiver: Compress ${dir} to ${format}`);
      fs.rmrf(dir, function(err) {
        console.log(err ? err : `  archiver: Deleted ${dir}`);
      })
    });

    archive.on("error", function(err) {
      throw err;
    });

    archive.pipe(output);

    archive.directory(dir, "/")
      .finalize();
  }
}
