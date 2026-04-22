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
  version = "1.0.2";

  src = fetchFromGitHub {
    owner = "steveyegge";
    repo = "beads";
    rev = "v${version}";
    hash = "sha256-aRgm2gWO08FZA2HaVxSitmjDk0Fp51oFZ8lmBCKDrzU=";
  };

  vendorHash = "sha256-stY1JxMAeINT73KCvwZyh/TUktkLirEcGa0sW1u7W1s=";

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
