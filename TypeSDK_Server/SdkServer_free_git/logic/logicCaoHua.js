/**
 * Created by TypeSDK 2016/10/10.
 */
var crypto = require('crypto');
var request = require('request');
var merge = require('merge');
var logicCommon = require('./logicCommon.js');

function convertParamLogin(query,ret)
{
    var org =
    {
        "id" : "0"
        ,"token": ""
        ,"data":""
        ,"sign":""
    };

    var cloned = merge(true, org);
    merge(cloned,query);

    for(var i in cloned)
    {
        //判断参数中是否该有的字段齐全
        if(org[i] == cloned[i] && i != "data" && i != "id")
        {
            return false;
        }

        //判断参数中是否有为空的字段
        if(0 == (cloned[i] + "").replace(/(^s*)|(s*$)/g, "").length && i != "data" && i != "id")
        {
            return false;
        }
    }
    ret.PUserID = cloned.id;
    ret.Token = cloned.token;

    return true;
}

function callChannelLogin(attrs,params,query,ret,retf,gattrs)
{
    var cloned = merge(true, params.out_params);
    merge(cloned,query);
    cloned.AppID = attrs.app_id;
    cloned.PUserID = query.PUserID;
    cloned.Token =  query.Token;
    cloned.Times =  Date.now();
    cloned.Sign =  crypto.createHash('md5').update(
        cloned.AppID +
        cloned.PUserID +
        cloned.Token +
        cloned.Times +
        attrs.app_key
    ).digest('hex').toUpperCase();

    var str = "AppID=" + cloned.AppID + "&" +
        "PUserID=" + cloned.PUserID + "&" +
        "Token=" + cloned.Token + "&" +
        "Times=" + cloned.Times + "&" +
        "Sign=" + cloned.Sign;

    var options = {
        url: params.out_url + "?" + str,
        method:params.method
    };

    console.log(options);

    //打点：登录验证
    logicCommon.sdkMonitorDot(logicCommon.dotType.LoginDot.RelaySDKVerify);
    request(options, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            var retOut =body;
            console.log(retOut);
            if(retOut.split("|",4)[0] == query.PUserID){
                //打点：验证成功
                logicCommon.sdkMonitorDot(logicCommon.dotType.LoginDot.ChVerifySuc);
                ret.code = 0;
                ret.msg = "NORMAL";
                ret.id = query.PUserID;
                ret.nick = "";
                ret.token = query.Token;
                ret.value = retOut;
                logicCommon.createLoginLog(gattrs.id,attrs.channel_id,attrs.sdk_name,ret.id);
            }
            else
            {
                //打点：验证失败
                logicCommon.sdkMonitorDot(logicCommon.dotType.LoginDot.ChVerifyErr);
                ret.code =  1;
                ret.msg = "LOGIN User ERROR";
                ret.id = "";
                ret.nick = "";
                ret.token = "";
                ret.value = retOut;
            }
        }
        else
        {
            //打点：验证失败
            logicCommon.sdkMonitorDot(logicCommon.dotType.LoginDot.ChVerifyErr);
            ret.code = 2;
            ret.msg = "OUT URL ERROR";
            ret.value = "";
        }
        retf(ret);
    });
}

function compareOrder(attrs,gattrs,params,query,ret,game,channel,retf){
    var retValue = {};
    retValue.code = 0;
    retValue.id = query.UserID;
    retValue.order = query.OrderNo;
    retValue.cporder =  query.OutPayNo;
    retValue.info = "";

    logicCommon.getNotifyUrl(retValue.cporder,params,function(hasData) {
        if (!hasData) {
            retf('1');
            return;
        } else  if (query.app_order_id == params.orderdata && query.product_id == params.goodsid && query.amount >= params.goodsprice*0.9&&query.amount <= params.goodsprice)
        {
            var data  = {};
            data.code = '0000';
            data.msg = 'NORMAL';
            retf(data);
            return;
        }
        else {
            retValue.sign = logicCommon.createSignPay(retValue,gattrs.gkey);
            logicCommon.UpdateOrderStatus(game,channel,retValue.cporder,retValue.order,1,0,query);
            var options = {
                url: params.verifyurl,
                method: "POST",
                body: retValue,
                json: true
            };
            request(options, function (error, response, body) {
                console.log('CB-CPServerBody: '+JSON.stringify(body));
                console.log('CB-CPServerBody: '+error);

                if(!error && response.statusCode == 200){
                    var retOut = body;
                    if (typeof retOut.code == 'undefined'){
                        retf('1');
                        return;
                    }
                    if(retOut.code =='0'){
                        if(retOut.Itemid){
                            logicCommon.mapItemLists(attrs,retOut);
                        }

                        if(query.Money*100>=retOut.amount*0.9 &&query.Money*100<=retOut.amount){
                            if(retOut.status=='2'){

                                retf('1');
                                return;
                            }else if(retOut.status=='4'||retOut.status=='3'){
                                logicCommon.UpdateOrderStatus(game,channel,retValue.cporder,retValue.order,4,query.Money*100);
                                retf('0');
                                return;
                            }else{
                                logicCommon.UpdateOrderStatus(game,channel,retValue.cporder,retValue.order,2,0);
                                var data  = {};
                                data.code = '0000';
                                data.msg = 'NORMAL';
                                retf(data);
                                return;
                            }
                        }else{
                            logicCommon.UpdateOrderStatus(game, channel, retValue.cporder, retValue.order, 3,0);
                            retf('1');
                            return;
                        }
                    }else{
                        retf('1');
                        return;
                    }
                }else{
                    retf('1');
                    return;
                }
            });
        }
    });

}

function callGamePay(attrs,gattrs,params,query,ret,retf,game,channel,channelId)
{
    var retValue = {};
    retValue.code = 0;
    retValue.id = query.UserID;
    retValue.order = query.OrderNo;
    retValue.cporder =  query.OutPayNo;
    retValue.info = "";

    logicCommon.getNotifyUrl(retValue.cporder,params,function(hasData){
        if(!hasData)
        {
            //打点：其他支付失败
            logicCommon.sdkMonitorDot(logicCommon.dotType.PayDot.Error);
            retf('FAILURE');
        }else{
            retValue.sign = logicCommon.createSignPay(retValue,gattrs.gkey);

            retValue.gamename = game;
            retValue.sdkname = channel;
            retValue.channel_id = channelId;
            retValue.amount = '' + query.Money * 100 + '';

            var options = {
                url: params.out_url,
                method: params.method,
                body: retValue,
                json: true
            };
            console.log(options);

            //打点：支付回调通知
            logicCommon.sdkMonitorDot(logicCommon.dotType.PayDot.PayNotice);
            request(options, function (error, response, body) {
                if (!error && response.statusCode == 200) {
                    var retOut = body;

                    //日志记录CP端返回
                    console.log(retOut);
                    if (typeof retOut.code == 'undefined'){
                        //打点：其他支付失败
                        logicCommon.sdkMonitorDot(logicCommon.dotType.PayDot.Error);
                        retf('1');
                    }

                    if (retOut.code == 0)
                    {
                        //打点：服务器正确处理支付成功回调
                        logicCommon.sdkMonitorDot(logicCommon.dotType.PayDot.PaySuc);
                        logicCommon.UpdateOrderStatus(game,channel,retValue.cporder,retValue.order,4,query.Money*100);
                        retf("1");
                    }
                    else{
                        //打点：其他支付失败
                        logicCommon.sdkMonitorDot(logicCommon.dotType.PayDot.Error);
                        retf('0');
                    }
                }else
                {
                    //打点：其他支付失败
                    logicCommon.sdkMonitorDot(logicCommon.dotType.PayDot.Error);
                    retf('0');
                }
            });
        }
    });
}

function checkSignPay(attrs,query)
{
    var osign = crypto.createHash('md5').update(
        query.OrderNo   +
        query.OutPayNo  +
        query.UserID +
        query.ServerNo +
        query.PayType +
        query.Money +
        query.PMoney +
        query.PayTime +
        attrs.secret_key
        //Date.now()
    ).digest('hex').toUpperCase();

    console.log(query.Sign + " :: " + osign);

    if (query.Sign != osign)
    {
        return false;
    }

    return true;

}

function checkOrder()
{
    return false;
}

/**
 * 核实外部订单号的唯一性
 * @param
 *      query   请求串Obj
 *      retf    返回校验结果 True 合法|False 不合法
 * */
function checkChOrder(game, channel,attrs, query, retf){
    var isIllegal = false;
    logicCommon.selCHOrderInRedis(channel,query.OrderNo,function(res){
        if(!res || typeof res == "undefined"){
            logicCommon.saveCHOrderInRedis(game, channel, query.OutPayNo, query.OrderNo,function(res){
                if(res && typeof res != "undefined"){
                    isIllegal = true;
                    retf(isIllegal);
                }else{
                    retf(isIllegal);
                }
            });
        }else{
            retf(isIllegal);
        }
    });
}

exports.convertParamLogin = convertParamLogin;
exports.callChannelLogin = callChannelLogin;
exports.checkSignPay = checkSignPay;
exports.callGamePay = callGamePay;
exports.checkOrder = checkOrder;
exports.compareOrder = compareOrder;
exports.checkChOrder = checkChOrder;