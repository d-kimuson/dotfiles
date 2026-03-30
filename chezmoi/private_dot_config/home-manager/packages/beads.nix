{
  lib,
  buildGoModule,
  fetchFromGitHub,
  makeWrapper,
  dolt,
  go_1_26,
  icu,
  pkg-config,
  versionCheckHook,
}:

buildGoModule.override { go = go_1_26; } rec {
  pname = "beads";
  version = "0.63.3";

  src = fetchFromGitHub {
    owner = "steveyegge";
    repo = "beads";
    rev = "v${version}";
    hash = "sha256-1AcsSDQXLcPLwIvV3dJ2DXYpeR2PAQCgUodclDMwg/s=";
  };

  vendorHash = "sha256-GYPfvsI8eNJbdzrbO7YnMkN2Yt6KZNB7w/2SJD2WdFY=";

  nativeBuildInputs = [
    makeWrapper
    pkg-config
  ];

  buildInputs = [
    icu
  ];

  subPackages = [ "cmd/bd" ];

  doCheck = false;

  postInstall = ''
    wrapProgram $out/bin/bd \
      --prefix PATH : ${lib.makeBinPath [ dolt ]}
  '';

  doInstallCheck = true;

  nativeInstallCheckInputs = [ versionCheckHook ];

  meta = with lib; {
    description = "A distributed issue tracker designed for AI-supervised coding workflows";
    homepage = "https://github.com/steveyegge/beads";
    changelog = "https://github.com/steveyegge/beads/releases/tag/v${version}";
    license = licenses.mit;
    sourceProvenance = with sourceTypes; [ fromSource ];
    mainProgram = "bd";
    platforms = platforms.unix;
  };
}
