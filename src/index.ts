import Promise from 'bluebird';
import * as path from 'path';
import { actions, fs, log, selectors, types, util } from 'vortex-api';
import * as winapi from 'winapi-bindings';

let _API;
const UMM_EXE = 'UnityModManager.exe';

// List of games which are supported by this modtype.
// TODO: Have this populated automatically using UMM's configuration files.
const gameSupport = ['dawnofman', 'gardenpaws', 'pathfinderkingmaker', 'oxygennotincluded'];

const isUMMExecPred = (filePath: string): boolean =>
  path.basename(filePath).toLowerCase() === UMM_EXE.toLowerCase();

function setUMMPath(resolvedPath: string, gameId: string) {
  const state = _API.store.getState();
  const tools = util.getSafe(state, ['settings', 'gameMode', gameId, 'tools'], undefined);

  if (tools !== undefined) {
    const validTools = Object.keys(tools)
      .filter(key => !!tools[key]?.path)
      .map(key => tools[key]);

    const UMM = validTools.find(tool => isUMMExecPred(tool.path));
    return (UMM !== undefined)
      ? (path.dirname(UMM.path) === resolvedPath)
        ? Promise.resolve()
        : createUMMTool(resolvedPath, UMM.id,  gameId)
      : createUMMTool(resolvedPath, 'UnityModManager', gameId);
  } else {
    return createUMMTool(resolvedPath, 'UnityModManager', gameId);
  }
}

function createUMMTool(ummPath, toolId, gameId) {
  _API.store.dispatch(actions.addDiscoveredTool(gameId, toolId, {
    id: 'UnityModManager',
    name: 'Unity Mod Manager',
    logo: 'umm.png',
    executable: () => UMM_EXE,
    requiredFiles: [UMM_EXE],
    path: path.join(ummPath, UMM_EXE),
    hidden: false,
    custom: false,
    workingDirectory: ummPath,
  }, true));

  return Promise.resolve();
}

function readRegistryKey(hive, key, name) {
  try {
    const instPath = winapi.RegGetValue(hive, key, name);
    if (!instPath) {
      throw new Error('empty registry key');
    }
    return Promise.resolve(instPath.value);
  } catch (err) {
    return Promise.resolve(undefined);
  }
}

function isSupported(gameId: string): boolean {
  return gameSupport.indexOf(gameId) !== -1;
}

function isUMMApp(files) {
  return files.find(file => isUMMExecPred(file)) !== undefined;
}

function testUmmApp(files, gameId) {
  const supported = ((isSupported(gameId)) && (isUMMApp(files)));
  return Promise.resolve({
    supported,
    requiredFiles: [],
  });
}

function installUMM(files, destinationPath, gameId) {
  const execFile = files.find(file => isUMMExecPred(file));
  const idx = execFile.indexOf(UMM_EXE);
  const installDir = selectors.installPathForGame(_API.store.getState(), gameId);
  const expectedDestination = path.join(installDir, path.basename(destinationPath, '.installing'));
  const instructions = files.map(file => {
    return {
      type: 'copy',
      source: file,
      destination: file.substr(idx),
    };
  });

  return setUMMPath(expectedDestination, gameId)
    .then(() => Promise.resolve({ instructions }));
}

function init(context: types.IExtensionContext) {
  _API = context.api;

  context.registerInstaller('umm-installer', 15, testUmmApp, installUMM);
  context.registerModType('umm', 15,
    (gameId) => isSupported(gameId),
    () => undefined,
    (instructions) => {
      const ummInstruction = instructions.find(instr => (instr.type === 'copy')
        && isUMMExecPred(instr.destination));
      return Promise.resolve(ummInstruction !== undefined);
    });

  context.once(() => {
    context.api.events.on('gamemode-activated', (gameMode: string) => {
      // We do this upon each gamemode activation as UMM is portable and
      //  we may find that it's no longer present within the directory we expect.
      return (isSupported(gameMode))
        ? readRegistryKey('HKEY_CURRENT_USER', 'Software\\UnityModManager', 'Path')
          .then(value => fs.statAsync(path.join(value, UMM_EXE))
            .then(() => setUMMPath(value, gameMode)))
          // UMM hasn't been installed/run prior to this point.
          .catch(() => Promise.resolve())
        : Promise.resolve();
    });
  });

  return true;
}

export default init;
