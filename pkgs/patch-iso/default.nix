{
  lib,
  python3,
  stdenvNoCC,
}:
stdenvNoCC.mkDerivation {
  pname = "agentic-rescue-patch";
  version = "0.1.0";
  src = ./.;
  buildInputs = [ python3 ];
  dontBuild = true;
  installPhase = ''
    install -Dm755 agentic-rescue-patch $out/bin/agentic-rescue-patch
    patchShebangs $out/bin
  '';
  meta = {
    description = "Write a configuration into the slot of an Agentic Rescue ISO";
    license = lib.licenses.mit;
    mainProgram = "agentic-rescue-patch";
    platforms = lib.platforms.unix;
  };
}
