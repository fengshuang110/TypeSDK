package com.type.sdk.application;

import android.app.Application;

import com.type.sdk.android.TypeSDKLogger;
import com.type.sdk.android.TypeSDKTool;
import com.type.sdk.android.huawei.TypeSDKBonjour;

public class TypeApplication extends Application{

	public TypeApplication() {
		
	}
	
	@Override
	public void onCreate() { 
		super.onCreate();
		TypeSDKLogger.e("TypeApplication");
		String buffStr = TypeSDKTool.getFromAssets(this, "CPSettings.txt");
        TypeSDKLogger.i(buffStr);
    	if(buffStr.length()>0)
    	{
    		TypeSDKBonjour.Instance().platform.StringToData(buffStr);
    		TypeSDKLogger.i(TypeSDKBonjour.Instance().platform.DataToString());
    	}
	}
	
}
