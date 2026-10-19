package com.debtfree.dashboard.dev;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        if ("com.debtfree.dashboard.connectedtest".equals(getPackageName())) {
            registerPlugin(ConnectedSecureStorePlugin.class);
        }
        super.onCreate(savedInstanceState);
    }
}
