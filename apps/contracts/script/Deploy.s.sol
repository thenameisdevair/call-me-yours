// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {CMY} from "../src/CMY.sol";

/// @notice Deploy CMY.sol to Celo Mainnet or Celo Sepolia.
///         Selects USDm address from chain id; seeds GF-01..GF-05 min prices.
contract Deploy is Script {
    // USDm per network.
    address internal constant USDM_MAINNET = 0x765DE816845861e75A25fCA122bb6898B8B1282a;
    address internal constant USDM_SEPOLIA = 0xdE9e4C3ce781b4bA68120d6261cbad65ce0aB00b;

    uint256 internal constant CELO_MAINNET = 42220;
    uint256 internal constant CELO_SEPOLIA = 11142220;

    // Initial connection fee: 0.05 USDm.
    uint256 internal constant INITIAL_CONNECTION_FEE = 0.05 ether;

    function run() external returns (CMY cmy) {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        address usdm = _usdmFor(block.chainid);

        vm.startBroadcast(pk);

        cmy = new CMY(deployer, INITIAL_CONNECTION_FEE, usdm);

        // Seed V1 gift catalogue (GF-01..GF-05), prices from phase2-requirements.
        cmy.updateMinGiftPrice("GF-01", 0.50 ether);
        cmy.updateMinGiftPrice("GF-02", 1.00 ether);
        cmy.updateMinGiftPrice("GF-03", 1.50 ether);
        cmy.updateMinGiftPrice("GF-04", 2.00 ether);
        cmy.updateMinGiftPrice("GF-05", 5.00 ether);

        vm.stopBroadcast();

        console2.log("chain id        :", block.chainid);
        console2.log("deployer        :", deployer);
        console2.log("USDm            :", usdm);
        console2.log("platformWallet  :", deployer);
        console2.log("connectionFee   :", INITIAL_CONNECTION_FEE);
        console2.log("CMY deployed at :", address(cmy));
    }

    function _usdmFor(uint256 chainId) internal pure returns (address) {
        if (chainId == CELO_MAINNET) return USDM_MAINNET;
        if (chainId == CELO_SEPOLIA) return USDM_SEPOLIA;
        revert("Deploy: unsupported chain");
    }
}
