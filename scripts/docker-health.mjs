try {
 const response=await fetch("http://127.0.0.1:3000/api/health",{signal:AbortSignal.timeout(5000)});
 const data=await response.json();if(!response.ok||data.status!=="ready")throw Error("Backend not ready");
}catch{process.exitCode=1;}
