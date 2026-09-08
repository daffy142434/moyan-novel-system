// let scoreArr = ['x','x','x','x','x','x','x','x','x','x','x','x']
let scoreArr = [9,'/',9,'/',9,'/',9,'/',9,'/',9,'/',9,'/',9,'/','1','x',9,'/']
let totalScore = 0
let turnArr = []
function getTurnCount (scoreArr){
    let lastTurn = 0 // 最后一轮标记，用于判断剩余分数. 此为枚举值，0表示常规，1表示补中，2表示全中
    for(let i =0;i<10;i++){
        if(scoreArr[0] === 'x'){
          turnArr[i] = scoreArr.unshift(0, 1)
        } else {
            turnArr[i] = scoreArr.splice(0,2)
        }
    }
    // 校验每轮球数据是否正确
    errorMessage = '数据出错了，有如下错误：'
    errorFlag = false
    turnArr.forEach((turn,index)=>{
        if(turn[1] === 'x'){
            errorFlag = true
            errorMessage += `第${index + 1}轮，全中不能为第二个球的数据`
        }
        if(turn[0] === '/'){
            errorFlag = true
            errorMessage += `第${index + 1}轮，补中不能为第一个球的数据`
        }
        if(scoreArr.length>2){
            errorFlag = true
            errorMessage += '数据超长了'
        }
    })
    console.log(turnArr)
}
getTurnCount(scoreArr)