const FUNCTIONS = new Set([
  "abs","sqrt","exp","ln","log10","sin","cos","tan","asin","acos","atan",
  "floor","ceil","round","min","max","avg","hypot","clamp","where","inrange",
  "normalize","grad","gradx","grady","isfinite","nan_to_num"
]);

function tokenize(expression) {
  const tokens=[];let index=0;
  while(index<expression.length){
    const rest=expression.slice(index);const whitespace=rest.match(/^\s+/);if(whitespace){index+=whitespace[0].length;continue;}
    const number=rest.match(/^(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/);if(number){tokens.push({type:"number",value:Number(number[0]),at:index});index+=number[0].length;continue;}
    const identifier=rest.match(/^[A-Za-z_][A-Za-z0-9_]*/);if(identifier){tokens.push({type:"identifier",value:identifier[0],at:index});index+=identifier[0].length;continue;}
    const operator=rest.match(/^(?:<=|>=|==|!=|&&|\|\||[+\-*/%^<>()!,])/);if(operator){tokens.push({type:"operator",value:operator[0],at:index});index+=operator[0].length;continue;}
    throw new Error(`Unexpected character “${expression[index]}” at column ${index+1}.`);
  }
  tokens.push({type:"eof",value:"",at:index});return tokens;
}

const PRECEDENCE={"||":1,"&&":2,"==":3,"!=":3,"<":4,"<=":4,">":4,">=":4,"+":5,"-":5,"*":6,"/":6,"%":6,"^":7};

export function parseFieldExpression(expression) {
  const text=String(expression||"").trim();if(!text)throw new Error("Enter an expression first.");
  const tokens=tokenize(text);let cursor=0;const peek=()=>tokens[cursor];const take=()=>tokens[cursor++];
  const expect=value=>{const token=take();if(token.value!==value)throw new Error(`Expected “${value}” at column ${token.at+1}.`);};
  function primary(){
    const token=take();
    if(token.type==="number")return{type:"number",value:token.value};
    if(token.value==="("){const node=expressionNode(0);expect(")");return node;}
    if(["+","-","!"].includes(token.value))return{type:"unary",operator:token.value,argument:primary()};
    if(token.type==="identifier"){
      if(peek().value!=="(")return{type:"identifier",name:token.value};
      take();const args=[];
      if(peek().value!==")"){do{args.push(expressionNode(0));if(peek().value!==",")break;take();}while(true);}
      expect(")");
      if(!FUNCTIONS.has(token.value.toLowerCase()))throw new Error(`Unknown function “${token.value}”.`);
      return{type:"call",name:token.value.toLowerCase(),args};
    }
    throw new Error(`Expected a number, field, or function at column ${token.at+1}.`);
  }
  function expressionNode(minimum){
    let left=primary();
    while(true){const token=peek(),precedence=PRECEDENCE[token.value];if(precedence==null||precedence<minimum)break;take();const right=expressionNode(precedence+(token.value==="^"?0:1));left={type:"binary",operator:token.value,left,right};}
    return left;
  }
  const ast=expressionNode(0);if(peek().type!=="eof")throw new Error(`Unexpected “${peek().value}” at column ${peek().at+1}.`);return ast;
}

const isArray=value=>Array.isArray(value)||ArrayBuffer.isView(value);
const finiteValues=value=>Array.from(value).filter(Number.isFinite);

function mapUnary(value,fn){return isArray(value)?Array.from(value,item=>fn(Number(item))):fn(Number(value));}
function mapMany(values,length,fn){return Array.from({length},(_,index)=>fn(...values.map(value=>isArray(value)?Number(value[index]):Number(value))));}
function resultLength(values,fallback){return values.find(isArray)?.length||fallback;}

function gradient(values,{nx,ny,dx,dy},component="magnitude"){
  if(!isArray(values))return Array(nx*ny).fill(0);const input=Array.from(values,Number);if(input.length!==nx*ny)throw new Error("Gradient input does not match the output grid.");
  const at=(column,row)=>input[Math.max(0,Math.min(ny-1,row))*nx+Math.max(0,Math.min(nx-1,column))];
  return input.map((value,index)=>{if(!Number.isFinite(value))return NaN;const column=index%nx,row=Math.floor(index/nx),left=Math.max(0,column-1),right=Math.min(nx-1,column+1),up=Math.max(0,row-1),down=Math.min(ny-1,row+1);const samples=[at(left,row),at(right,row),at(column,up),at(column,down)];if(!samples.every(Number.isFinite))return NaN;const gx=(samples[1]-samples[0])/(Math.max(1,right-left)*(Math.abs(dx)||1));const gy=(samples[2]-samples[3])/(Math.max(1,down-up)*(Math.abs(dy)||1));return component==="x"?gx:component==="y"?gy:Math.hypot(gx,gy);});
}

function evaluateCall(name,args,grid){
  const length=resultLength(args,grid.nx*grid.ny),unary=fn=>mapUnary(args[0],fn);if(!args.length)throw new Error(`${name}() needs at least one argument.`);
  if(name==="abs")return unary(Math.abs);if(name==="sqrt")return unary(value=>value>=0?Math.sqrt(value):NaN);if(name==="exp")return unary(Math.exp);if(name==="ln")return unary(value=>value>0?Math.log(value):NaN);if(name==="log10")return unary(value=>value>0?Math.log10(value):NaN);
  if(name==="sin")return unary(Math.sin);if(name==="cos")return unary(Math.cos);if(name==="tan")return unary(Math.tan);if(name==="asin")return unary(Math.asin);if(name==="acos")return unary(Math.acos);if(name==="atan")return unary(Math.atan);if(name==="floor")return unary(Math.floor);if(name==="ceil")return unary(Math.ceil);if(name==="round")return unary(Math.round);
  if(name==="grad")return gradient(args[0],grid);if(name==="gradx")return gradient(args[0],grid,"x");if(name==="grady")return gradient(args[0],grid,"y");
  if(name==="normalize"){if(!isArray(args[0]))return 0;const finite=finiteValues(args[0]),low=Math.min(...finite),high=Math.max(...finite),span=high-low;return mapUnary(args[0],value=>Number.isFinite(value)?(span?((value-low)/span):0):NaN);}
  if(name==="min"&&args.length===1&&isArray(args[0]))return Math.min(...finiteValues(args[0]));if(name==="max"&&args.length===1&&isArray(args[0]))return Math.max(...finiteValues(args[0]));
  if(name==="min")return mapMany(args,length,(...values)=>Math.min(...values));if(name==="max")return mapMany(args,length,(...values)=>Math.max(...values));if(name==="avg")return mapMany(args,length,(...values)=>values.reduce((sum,value)=>sum+value,0)/values.length);if(name==="hypot")return mapMany(args,length,(...values)=>Math.hypot(...values));
  if(name==="clamp"){if(args.length!==3)throw new Error("clamp(value, minimum, maximum) needs three arguments.");return mapMany(args,length,(value,low,high)=>Math.max(low,Math.min(high,value)));}
  if(name==="where"){if(args.length!==3)throw new Error("where(condition, trueValue, falseValue) needs three arguments.");return mapMany(args,length,(condition,yes,no)=>condition?yes:no);}
  if(name==="inrange"){if(args.length!==3)throw new Error("inrange(value, minimum, maximum) needs three arguments.");return mapMany(args,length,(value,low,high)=>value>=low&&value<=high?1:0);}
  if(name==="isfinite")return unary(value=>Number.isFinite(value)?1:0);if(name==="nan_to_num"){const replacement=args[1]??0;return mapMany([args[0],replacement],length,(value,fallback)=>Number.isFinite(value)?value:fallback);}
  throw new Error(`Unsupported function “${name}”.`);
}

function evaluateNode(node,variables,grid,used){
  if(node.type==="number")return node.value;
  if(node.type==="identifier"){const lower=node.name.toLowerCase();if(lower==="pi")return Math.PI;if(lower==="e")return Math.E;if(!Object.hasOwn(variables,node.name))throw new Error(`Unknown field “${node.name}”. Use a field button to insert its exact name.`);used.add(node.name);return variables[node.name];}
  if(node.type==="unary"){const value=evaluateNode(node.argument,variables,grid,used);if(node.operator==="+")return mapUnary(value,item=>item);if(node.operator==="-")return mapUnary(value,item=>-item);return mapUnary(value,item=>item?0:1);}
  if(node.type==="call")return evaluateCall(node.name,node.args.map(arg=>evaluateNode(arg,variables,grid,used)),grid);
  const left=evaluateNode(node.left,variables,grid,used),right=evaluateNode(node.right,variables,grid,used),length=resultLength([left,right],grid.nx*grid.ny);
  const operations={"+":(a,b)=>a+b,"-":(a,b)=>a-b,"*":(a,b)=>a*b,"/":(a,b)=>Math.abs(b)>Number.EPSILON?a/b:NaN,"%":(a,b)=>Math.abs(b)>Number.EPSILON?a%b:NaN,"^":(a,b)=>a**b,"<":(a,b)=>a<b?1:0,"<=":(a,b)=>a<=b?1:0,">":(a,b)=>a>b?1:0,">=":(a,b)=>a>=b?1:0,"==":(a,b)=>a===b?1:0,"!=":(a,b)=>a!==b?1:0,"&&":(a,b)=>a&&b?1:0,"||":(a,b)=>a||b?1:0};
  return mapMany([left,right],length,operations[node.operator]);
}

export function evaluateFieldExpression(expression,variables,grid){
  const ast=parseFieldExpression(expression),used=new Set(),raw=evaluateNode(ast,variables,grid,used),size=Number(grid.nx)*Number(grid.ny);const values=isArray(raw)?Array.from(raw,Number):Array(size).fill(Number(raw));if(values.length!==size)throw new Error("Expression result does not match the selected output grid.");return{values,identifiers:[...used],ast};
}
