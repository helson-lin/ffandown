@echo off

REM Read version from package.json
REM for /f "tokens=2 delims=:" %%a in ('node -p "require('./package.json').version"') do set VERSION=%%a
set VERSION=latest

REM Define image name and tag
set IMAGE_NAME=h55205l/ffandown
set IMAGE_TAG=%IMAGE_NAME%:%VERSION%

REM Checking for dist directory
echo Checking for dist directory...
if exist dist (
  echo Removing existing dist directory...
  npm run clean
)

REM Gulp html
echo Gulp Html...
npm run gulp

REM Build package
echo Building package...
npm run pkg

REM Remove existing Docker image (if any)
echo Removing existing Docker image...
docker image rm -f "%IMAGE_TAG%" >nul 2>&1

echo Building new Docker image...
REM Build new Docker image
docker build -t "%IMAGE_TAG%" .

echo Done.