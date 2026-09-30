{
  description = "Agentic Rescue: a NixOS live rescue system with opencode, Claude Code and Codex built in";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  };

  outputs =
    { self, nixpkgs }:
    let
      inherit (nixpkgs) lib;

      # Targets the ISO is built for. BIOS boot is x86 only; aarch64 boots via EFI.
      systems = [
        "x86_64-linux"
        "aarch64-linux"
      ];

      # Systems the helper tools (patch CLI, dev shell) are available on.
      toolSystems = systems ++ [
        "aarch64-darwin"
        "x86_64-darwin"
      ];

      version = "0.1.0";

      forAll = systems: f: lib.genAttrs systems (system: f nixpkgs.legacyPackages.${system});

      mkRescue =
        {
          system,
          offline ? false,
          extraModules ? [ ],
        }:
        lib.nixosSystem {
          inherit system;
          specialArgs = {
            rescueVersion = version;
            rescueOffline = offline;
          };
          modules = [
            "${nixpkgs}/nixos/modules/installer/cd-dvd/installation-cd-minimal.nix"
            self.nixosModules.default
            { rescue.inference.enable = offline; }
          ]
          ++ extraModules;
        };

      isoOf = cfg: cfg.config.system.build.isoImage;
    in
    {
      nixosModules = {
        default = import ./modules;
        agentic-rescue = self.nixosModules.default;
      };

      nixosConfigurations = lib.listToAttrs (
        lib.concatMap (system: [
          {
            name = "rescue-${system}";
            value = mkRescue { inherit system; };
          }
          {
            name = "rescue-offline-${system}";
            value = mkRescue {
              inherit system;
              offline = true;
            };
          }
        ]) systems
      );

      # Function for people who want to bake their own configuration into the slot at build time:
      #   (agentic-rescue.lib.mkIso { system = "x86_64-linux"; config = { providers.groq.key = "..."; }; })
      lib.mkIso =
        {
          system,
          offline ? false,
          config ? null,
          modules ? [ ],
        }:
        isoOf (mkRescue {
          inherit system offline;
          extraModules = modules ++ lib.optional (config != null) { rescue.config = config; };
        });

      packages =
        (forAll toolSystems (pkgs: {
          patch-iso = pkgs.callPackage ./pkgs/patch-iso { };
        }))
        // lib.genAttrs systems (
          system:
          let
            pkgs = nixpkgs.legacyPackages.${system};
            rescue = self.nixosConfigurations."rescue-${system}";
            offline = self.nixosConfigurations."rescue-offline-${system}";
          in
          {
            patch-iso = pkgs.callPackage ./pkgs/patch-iso { };
            rescue-cli = pkgs.callPackage ./pkgs/rescue-cli { };

            iso = isoOf rescue;
            iso-offline = isoOf offline;

            # ISO plus release.json (offset of the config slot, size, checksum) for the download page.
            release = pkgs.callPackage ./pkgs/release {
              iso = isoOf rescue;
              inherit version;
              variant = "online";
              patch-iso = self.packages.${system}.patch-iso;
            };
            release-offline = pkgs.callPackage ./pkgs/release {
              iso = isoOf offline;
              inherit version;
              variant = "offline";
              patch-iso = self.packages.${system}.patch-iso;
            };

            default = self.packages.${system}.iso;
          }
        );

      apps = forAll toolSystems (pkgs: {
        patch = {
          type = "app";
          program = lib.getExe self.packages.${pkgs.system}.patch-iso;
        };
      });

      checks = lib.genAttrs systems (
        system:
        let
          pkgs = nixpkgs.legacyPackages.${system};
        in
        {
          # Cheap: exercises rescue-config against a sample slot in a fake root.
          rescue-config = pkgs.callPackage ./checks/rescue-config.nix {
            rescue-cli = self.packages.${system}.rescue-cli;
          };
          shellcheck = self.packages.${system}.rescue-cli.tests.shellcheck;
          # Cheap: the patch tool against a synthetic ISO with a slot.
          patch-tool = pkgs.callPackage ./checks/patch-tool.nix {
            patch-iso = self.packages.${system}.patch-iso;
          };
          # Expensive: builds the real ISO, patches it, extracts the slot again and compares.
          slot-patch = pkgs.callPackage ./checks/slot-patch.nix {
            release = self.packages.${system}.release;
            patch-iso = self.packages.${system}.patch-iso;
          };
        }
      );

      devShells = forAll toolSystems (pkgs: {
        default = pkgs.mkShell {
          packages = with pkgs; [
            xorriso
            python3
            shellcheck
            nixfmt
            jq
            gum
          ];
        };
      });

      formatter = forAll toolSystems (pkgs: pkgs.nixfmt);
    };
}
