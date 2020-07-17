const fs = require('fs')
const path = require('path')
const minimist = require("minimist")
const express = require('express');
const nodeExcel = require('excel-export');
const {execSync} = require('child_process');
const app = express();
 
const rootPath = path.join(__dirname, '..') //工程根目录路径
const rootDirName = rootPath.slice(rootPath.lastIndexOf('/') + 1) //工程文件夹名
const fileReg = /^[a-z]+[-0-9a-z]{0,}[^-]$/; //数字小写字母中华线组成字符串，且不以数字中华线开头，不以中华线结尾
//检测的文件类型
const checkExtArr = ['vue','js','ts','scss','css'];
//不符合规范的文件名路径
let errorName = [];
//不符合规范的文件名
const fileNameArr = [];
//替换次数
let index = 0;
//excel数据
var temp = [];
 
//解析命令行参数
let argvParams = minimist(process.argv.slice(2))
//不填写范围默认client下
let searchScope = 'client';
let replaceScope = 'client';
 //示例命令行写法：  node gitHooks/change-filename.js  --searchScope=client --replaceScope=client
if (argvParams['searchScope']) {
  searchScope = argvParams['searchScope'];
}
 
if (argvParams['replaceScope']) {
 replaceScope = argvParams['replaceScope']
}
  
 
//获取所有的文件
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
    //完整的路径
    const filePath = fileList[i];
    let arr = [];
    //因为windows获取的文件路径有问题，判断如果是windows并且是all的情况就用\\分割  其他windows情况未测
    if(process.platform == 'win32'){
      arr = filePath.split("\\");
    }else{
      arr = filePath.split("/");
    }
    //获取到文件名
    const filename = arr[arr.length - 1];
    const fileName = filename.split('.')[0];
 
    //文件扩展名
    const extname = path.extname(filePath).slice(1);
    let isMatch = false;
    //只对vue、js、ts、scss、css文件进行检测
    if(checkExtArr.indexOf(extname) != -1){
      isMatch = fileReg.test(fileName);
    }else{
      isMatch = true;
    }
     
    if (!isMatch) {
      //路径截取
      const index = filePath.indexOf(rootDirName);
      fileNames.push(filePath.slice(index < 0 ? 0 : index));
      //组成不规范文件名数组
      fileNameArr.push(fileName)
    }
  }
 
  return fileNames;
}
 
(async function(){
 
 async function searchAndReplace(scope,filename,errorName) {
 
  let file = await fs.readdirSync(scope);
    //遍历每一个文件
   for(let i = 0; i < file.length; i++){
     //构造文件的路径
     var filePath = path.join(scope,file[i]);
     let stats =  fs.statSync(filePath);
 
     //如果是文件就可以进一步读取文件的内容
     if(stats.isFile()){
 
      //读取文件内容
       var fileContent = fs.readFileSync(filePath,'utf-8');
       //设置匹配 /filename 形式的规则
       var reg = eval(`/\\/${filename}\\b/g`);
       //替换生成新内容
       var newContent = fileContent.replace(reg,function(word){
         index++;
         //把驼峰的替换成中划线连接的
         var result = word.replace(/[A-Z]/g,'-$&').toLowerCase().replace('/-','/');
 
         console.log('修改的文件为：',filePath,'其中不规范文件名为：',word,'重命名为：',result,"  ",filename,"的修改次数为:",index)
         //构造excel数据
         temp.push([errorName,filePath,word,result,index])
 
         return result;
      })
      //新内容写入文件
      fs.writeFileSync(filePath,newContent)
        
     }else{
       //如果是文件夹继续遍历
       await searchAndReplace(path.join(scope, file[i]),filename,errorName)
     }
    }
}
 
//生成excel函数，不需要可注掉。
 async function exportExcel(){
   app.get('/Excel', function(req, res){
    var conf ={};
    conf.name = "mysheet";
    conf.cols = [{
      caption:'不规则文件名路径',
      type:'string'
     },{
      caption:'目标修改的文件路径',
      type:'string'
     },{
      caption:'要修改的不规范字符串',
      type:'string'
     },{
      caption:'修改完的字符串',
      type:'string'
     },{
      caption:'不规则文件名修改的次数',
      type:'number'
     }];
 
     conf.rows = temp;
 
    var result = nodeExcel.execute(conf);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats;charset=utf-8');
    res.setHeader("Content-Disposition", "attachment; filename=" + "Report.xlsx");
    res.end(result, 'binary');
    });
    
   app.listen(3000);
   console.log('Listening on port 3000');
}
 
 //1.搜索不规范文件
 const rootDirs = path.resolve(path.join(__dirname, `../${searchScope}`))
 let filesList = getAllFiles(rootDirs);
 //获取到不符合规范的文件名路径
 errorName = getErrorFileName(filesList);
 
 
 //2.进行文件内容和文件名修改
 for(let i = 0; i < fileNameArr.length; i++){
 
  //2.1搜索引入此不规范文件的文件，并对其内容进行修改
  const scope =  path.resolve(path.join(__dirname, `../${replaceScope}`))
  await searchAndReplace(scope,fileNameArr[i],errorName[i]);
  index = 0;
   
  //2.1对此不符合规范的文件的文件名进行修改
 
  //构建规范的文件名
  var newfileNameArr = fileNameArr[i].replace(/[A-Z]/g,'-$&').toLowerCase().replace(/^-/,'');
  //构建新的文件路径
  var reg = eval(`/${fileNameArr[i]}\\./`);
  var newFileName = errorName[i].replace(reg,newfileNameArr+'.')
  //进行文件名修改
  execSync(`git mv ${errorName[i]} ${newFileName} `)
 }
  //最后导出excel表格
  exportExcel();
 
})()

