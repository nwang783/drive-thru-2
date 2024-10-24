export class FunctionCallTracker {
    constructor() {
      this.calls = new Map();
      this.callStack = [];
    }
  
    // Track when a function starts
    trackStart(functionName, args, source) {
      const callId = Date.now() + '-' + Math.random();
      const callInfo = {
        id: callId,
        functionName,
        args,
        source,
        startTime: Date.now(),
        endTime: null,
        duration: null
      };
      
      this.calls.set(callId, callInfo);
      this.callStack.push(callInfo);
      
      console.log(`[${source}] Starting ${functionName} call:`, {
        callId,
        args,
        stackDepth: this.callStack.length
      });
      
      return callId;
    }
  
    // Track when a function ends
    trackEnd(callId, result) {
      const callInfo = this.calls.get(callId);
      if (callInfo) {
        callInfo.endTime = Date.now();
        callInfo.duration = callInfo.endTime - callInfo.startTime;
        callInfo.result = result;
        
        this.callStack.pop();
        
        console.log(`[${callInfo.source}] Completed ${callInfo.functionName} call:`, {
          callId,
          duration: callInfo.duration,
          result,
          stackDepth: this.callStack.length
        });
      }
    }
  
    // Get statistics about function calls
    getStats() {
      const stats = {
        totalCalls: this.calls.size,
        callsByFunction: new Map(),
        callsBySource: new Map(),
        duplicateCalls: []
      };
  
      for (const call of this.calls.values()) {
        // Track calls by function name
        if (!stats.callsByFunction.has(call.functionName)) {
          stats.callsByFunction.set(call.functionName, []);
        }
        stats.callsByFunction.get(call.functionName).push(call);
  
        // Track calls by source
        if (!stats.callsBySource.has(call.source)) {
          stats.callsBySource.set(call.source, []);
        }
        stats.callsBySource.get(call.source).push(call);
      }
  
      // Detect potential duplicate calls
      for (const [funcName, calls] of stats.callsByFunction) {
        if (calls.length > 1) {
          for (let i = 0; i < calls.length - 1; i++) {
            const call1 = calls[i];
            const call2 = calls[i + 1];
            if (
              JSON.stringify(call1.args) === JSON.stringify(call2.args) &&
              Math.abs(call1.startTime - call2.startTime) < 1000
            ) {
              stats.duplicateCalls.push({
                functionName: funcName,
                call1,
                call2,
                timeDifference: call2.startTime - call1.startTime
              });
            }
          }
        }
      }
  
      return stats;
    }
  
    // Clear all tracking data
    reset() {
      this.calls.clear();
      this.callStack = [];
    }
  }