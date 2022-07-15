const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const md5JS = require('md5-js');
const jsondiffpatch = require('jsondiffpatch');
const utils = require('./utils');
const { parserFileAST, traverseAST, getNodeFromAST } = require('./parser');
const { OUTPUT_PATH, FILE_MAP_FILE, ELEMENT_MAP_FILE } = require('./constant');
// 配置项
let diffOptions = {
  // 项目名称（容器）
  projectName: 'default',
  // 包含扫描目录
  includes: ['src']
}

/**
 * @description 封装md5加密工具
 * @param {string} str 加密内容
 */
const md5 = function(str) {
  return md5JS(`${diffOptions.projectName}::${str}`);
}

/**
 * @test id
 * @description 对比历史记录，生成差异分析报告  
 */
const generateDiffReport = function(fileMap, lastFileMap) {
  // console.log(jsondiffpatch.diff(fileMap, lastFileMap));
}

/**
 * @description 提炼关键元素，生成元素变更关系日志
 * @param {Object} fileMap 变更文件映射关系
 */
const setElementMap = function(fileMap) {
  const elementMap = {};
  for (const pKey in fileMap) {
    const file = fileMap[pKey]
    for (const funcNode of file.funcNodes) {
      // console.log(funcNode);
      const eKey = md5(`${file.p}::${funcNode.name}`);
      const element = {
        eKey,
        pKey,
        e: funcNode.name,
        p: file.p,
        type: funcNode.type,
      }
      elementMap[eKey] = element;
    }
  }
  console.log(elementMap);
  // 更新变更日志
  fs.writeFileSync('./.diff_output/element-map.json', utils.stringify(elementMap), {});
}

/**
 * @description 获取文件变更信息
 * @param {string} p 文件路径
 */
const getFileInfo = function(p) {
  return new Promise((resolve) => {
    const pKey = md5(p);
    const type = p.split('.').pop();
    try {
      const code = fs.readFileSync(p, 'utf-8');
      // 文件存在，则解析内容，转为AST格式
      const ast = parserFileAST(code, type);
      const {
        funcNodes,
        variableNodes
      } = getNodeFromAST(ast, type);
      resolve({
        pKey,
        p,
        type,
        ast,
        code,
        funcNodes,
        variableNodes,
        diff: 'change',
      });
    } catch(err) {
      // 文件不存在，则视为删除
      console.log(err)
      resolve({
        pKey,
        p,
        type,
        ast: '',
        code: '',
        funcNodes: [],
        variableNodes: [],
        diff: 'remove',
      });
    }
  })
}

/**
 * @description 设置文件变更关系
 * @param {Array<string>} diffFilePaths 变更的文件路径集合
 */
const setFileMap = async function(diffFilePaths) {
  // 上一次文件变更记录
  let lastFileMap = null;
  // 文件变更关系集合
  let fileMap = {};
  for (const p of diffFilePaths) {
    const fileInfo =  await getFileInfo(p);
    fileMap[fileInfo.pKey] = fileInfo;
  }
  const fileMapPath = path.resolve(path.join(OUTPUT_PATH, FILE_MAP_FILE));
  try {
    fs.accessSync(OUTPUT_PATH);
  } catch(err) {
    console.log('> mkdir ', OUTPUT_PATH);
    // 没有输出目录则新建一个
    fs.mkdirSync(OUTPUT_PATH);
  } finally {
    try {
      lastFileMap = fs.readFileSync(fileMapPath, 'utf-8');
    } catch(err) {
      // 不存在上一次变更记录
      lastFileMap = null;
    } finally {
      console.log('> output ', fileMapPath);
      // 更新变更日志
      fs.writeFileSync(fileMapPath, utils.stringify(fileMap), {});
      setElementMap(fileMap);
    }
  }
}

/**
 * @description 分析git提交记录，获取差异文件
 */
const getDiffFiles = function() {
  try {
    // 根据扫描范围，获取差异文件路径集合
    const diffFilePaths = execSync('git diff --name-only master').toString().split('\n').filter(v => !!v && v.includes(diffOptions.includes));
    console.log('> diff files ', diffFilePaths)
    setFileMap(diffFilePaths);
  } catch(err) {
    console.log('error: ', err);
  }
}

module.exports = function(options) {
  if (options) {
    diffOptions.projectName = options.projectName || diffOptions.projectName;
    diffOptions.includes = options.includes || diffOptions.includes;
  }
  getDiffFiles();
}
