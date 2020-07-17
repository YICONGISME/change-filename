const { execSync } = require("child_process");
const fs = require('fs')
const path = require('path')
const minimist = require("minimist")

const rootPath = path.join(__dirname, '..') //工程根目录路径
const rootDirName = rootPath.slice(rootPath.lastIndexOf('/') + 1) //工程文件夹名
const fileReg = /^[a-z]+[-0-9a-z]{0,}[^-]$/; //数字小写字母中华线组成字符串，且不以数字中华线开头，不以中华线结尾
const imgReg = /^[a-z]+[-@0-9a-z]{0,}[^-@]$/; //图片正则z

const imgExtArr = ['png','jpg','jpeg','gif']
let errorName = [];
//检查模式参数
let argv = 'commit';
//解析命令行参数
let argvParams = minimist(process.argv.slice(2))

if (argvParams['noVerify']) {
  console.log('-------no-verify 跳过检查------')
  process.exit(0);
  return
}

if (!argvParams['scope']) {
  console.log('-------no scope 请检查检测范围------')
  process.exit(-1);
  return
}

if (argvParams.module == 'all' || argvParams.module == 'commit') {
  argv = argvParams.module;
}
console.log('====检测模式参数====：' + argv)

if (argv == 'commit') {
  console.log('-------检测提交文件---------')
  let filesList = getFilenamesByCommand("git diff --cached --name-only").split("\n");
  filesList = filesList.filter(filePath=>{
    return filePath.indexOf(`${argvParams['scope']}`) != -1
  })
  console.log('待检测文件数量：' + filesList.length)
  errorName = getErrorFileName(filesList);
} else {
  console.log('---------检测全部文件--------')
  const rootDirs = path.resolve(path.join(__dirname, `../${argvParams['scope']}`))
  let filesList = getAllFiles(rootDirs);
  console.log('待检测文件数量：' + filesList.length)
  errorName = getErrorFileName(filesList);
}

//获取command命令对应的文件
function getFilenamesByCommand(command) {
  return execSync(command).toString('utf8').trim();
}
function getAllFiles(dirs) {
  let files = [];
  let fileList = fs.readdirSync(dirs);
  for (let file of fileList) {
    const currentPath = path.resolve(dirs, file)
    const stat = fs.statSync(currentPath)
    const isDirectory = stat.isDirectory();
    if (isDirectory) {
      files = files.concat(getAllFiles(currentPath))
    } else {
      files.push(currentPath)
    }
  }
  return files
}
//获取不符合规范的文件路径
function getErrorFileName(fileList) {
  let fileNames = [];
  for (let i = 0; i < fileList.length; i++) {
    const filePath = fileList[i];
    const arr = filePath.split("/");
    const filename = arr[arr.length - 1];
    const extname = path.extname(filePath).slice(1);
    let isMatch = false;
    if(imgExtArr.indexOf(extname) == -1){
      isMatch = fileReg.test(filename.split('.')[0]);
    }else{
      isMatch = imgReg.test(filename.split('.')[0]);
    }

    if (!isMatch) {
      //路径截取
      const index = filePath.indexOf(rootDirName);
      fileNames.push(filePath.slice(index < 0 ? 0 : index));
    }
  }
  return fileNames;
}

if (errorName.length) {
  console.log('不符合规范文件数量：' + errorName.length + '\n');
  console.log('文件规则：数字、小写字母、中华线 组成字符串，且不以数字中华线开头，不以中华线结尾' + '\n');
  console.log('图片规则：数字、小写字母、中华线、@符 组成字符串，且不以数字中华线开头，不以中华线、@符结尾' + '\n');
  console.log('不符合规范文件:' + '\n');
  console.log(errorName.join('\n'))
  process.exit(-1);
} else {
  console.log('is ok to commit')
  process.exit(0);
}
