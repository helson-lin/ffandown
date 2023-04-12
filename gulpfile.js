const gulp = require('gulp')
const rename = require('gulp-rename')
const htmlmin = require('gulp-html-minifier-terser')

gulp.task('minify-html', () => {
    return gulp.src('public/_index.html')
    .pipe(htmlmin({
        removeComments: true,
        collapseWhitespace: true,
        collapseBooleanAttributes: true,
        removeEmptyAttributes: true,
        removeScriptTypeAttributes: true,
        removeStyleLinkTypeAttributes: true,
        minifyJS: true,
        minifyCSS: true,
    }))
    .pipe(rename('index.html'))
    .pipe(gulp.dest('public'))
})

// const watcher = () => {
// gulp.watch('public/_index.html', gulp.series('minify-html'))
// }
gulp.task('default', gulp.series('minify-html', done => {
    done()
}))